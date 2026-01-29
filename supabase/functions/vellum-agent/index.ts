import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VellumRequest {
  gameId: string;
  action: 'give_clue' | 'make_guess';
  playerId: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { gameId, action, playerId } = await req.json() as VellumRequest;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch game and player data
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (gameError || !game) {
      console.error('Game fetch error:', gameError);
      return new Response(JSON.stringify({ error: 'Game not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: player, error: playerError } = await supabase
      .from('game_players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError || !player) {
      console.error('Player fetch error:', playerError);
      return new Response(JSON.stringify({ error: 'Player not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch API key from user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('vellum_api_key')
      .eq('user_id', player.user_id)
      .single();

    if (profileError || !profile?.vellum_api_key) {
      return new Response(JSON.stringify({ error: 'Player missing Vellum API key in profile' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!player.vellum_agent_id) {
      return new Response(JSON.stringify({ error: 'Player missing Vellum agent selection' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vellumApiKey = profile.vellum_api_key;

    const words = game.words as string[];
    const wordAssignments = game.word_assignments as Record<string, string>;
    const revealedWords = (game.revealed_words as string[]) || [];
    const unrevealedWords = words.filter(w => !revealedWords.includes(w));

    if (action === 'give_clue') {
      // Spymaster gives a clue
      const teamWords = unrevealedWords.filter(w => wordAssignments[w] === player.team);
      const opposingWords = unrevealedWords.filter(w => wordAssignments[w] !== player.team && wordAssignments[w] !== 'neutral' && wordAssignments[w] !== 'assassin');
      const neutralWords = unrevealedWords.filter(w => wordAssignments[w] === 'neutral');
      const assassinWord = unrevealedWords.find(w => wordAssignments[w] === 'assassin');

      const prompt = `You are the spymaster in a game of Codenames. Your team is ${player.team}.

Your team's words (you want your operatives to guess these): ${teamWords.join(', ')}
Opposing team's words (avoid making operatives guess these): ${opposingWords.join(', ')}
Neutral words (avoid these, but they only end the turn): ${neutralWords.join(', ')}
Assassin word (NEVER give a clue that could lead to this): ${assassinWord}

Give a one-word clue and a number indicating how many words it relates to.
The clue MUST NOT be any word on the board or a derivative of any word on the board.
The clue must be a single word with no spaces, hyphens, or special characters.

Respond in this exact JSON format:
{"clue": "YOUR_CLUE", "number": N}

Think strategically - try to link multiple of your team's words while avoiding words that could lead to opposing team, neutral, or assassin words.`;

      const vellumResponse = await callVellumAgent(vellumApiKey, player.vellum_agent_id, prompt);
      console.log('Vellum spymaster response:', vellumResponse);

      // Parse the clue from the response
      const clueMatch = vellumResponse.match(/\{[\s\S]*?"clue"[\s\S]*?:[\s\S]*?"([^"]+)"[\s\S]*?,[\s\S]*?"number"[\s\S]*?:[\s\S]*?(\d+)[\s\S]*?\}/);
      if (!clueMatch) {
        return new Response(JSON.stringify({ error: 'Failed to parse clue from agent', raw: vellumResponse }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const clue = clueMatch[1].toUpperCase();
      const number = parseInt(clueMatch[2], 10);

      // Update game with the clue
      await supabase.from('games').update({
        current_clue: clue,
        current_clue_number: number,
        guesses_remaining: number + 1, // +1 bonus guess
        current_phase: 'operative_guess',
      }).eq('id', gameId);

      return new Response(JSON.stringify({ success: true, clue, number }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'make_guess') {
      // Operative makes a guess
      const prompt = `You are an operative in a game of Codenames. Your team is ${player.team}.

Current clue: "${game.current_clue}" (${game.current_clue_number} words)
Unrevealed words on the board: ${unrevealedWords.join(', ')}
Guesses remaining: ${game.guesses_remaining}

Based on the clue, guess ONE word from the unrevealed words that you think belongs to your team.
You can also choose to "PASS" if you're unsure and want to end your turn safely.

Respond in this exact JSON format:
{"guess": "YOUR_GUESS"} or {"guess": "PASS"}

The guess MUST be exactly one of the unrevealed words listed above, or "PASS".`;

      const vellumResponse = await callVellumAgent(vellumApiKey, player.vellum_agent_id, prompt);
      console.log('Vellum operative response:', vellumResponse);

      // Parse the guess from the response
      const guessMatch = vellumResponse.match(/\{[\s\S]*?"guess"[\s\S]*?:[\s\S]*?"([^"]+)"[\s\S]*?\}/);
      if (!guessMatch) {
        return new Response(JSON.stringify({ error: 'Failed to parse guess from agent', raw: vellumResponse }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const guess = guessMatch[1].toUpperCase();

      if (guess === 'PASS') {
        // End turn
        const nextTeam = player.team === 'red' ? 'blue' : 'red';
        await supabase.from('games').update({
          current_team: nextTeam,
          current_phase: 'spymaster_clue',
          current_clue: null,
          current_clue_number: null,
          guesses_remaining: null,
        }).eq('id', gameId);

        return new Response(JSON.stringify({ success: true, action: 'pass', nextTeam }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Find the matching word (case insensitive)
      const matchedWord = unrevealedWords.find(w => w.toUpperCase() === guess);
      if (!matchedWord) {
        return new Response(JSON.stringify({ error: 'Invalid guess - word not on board', guess }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const wordType = wordAssignments[matchedWord];
      const newRevealedWords = [...revealedWords, matchedWord];

      // Check game over conditions
      if (wordType === 'assassin') {
        const winner = player.team === 'red' ? 'blue' : 'red';
        await supabase.from('games').update({
          revealed_words: newRevealedWords,
          status: 'finished',
          winner,
          current_phase: 'game_over',
        }).eq('id', gameId);

        return new Response(JSON.stringify({ success: true, action: 'assassin', winner, guess: matchedWord }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if team won
      const teamWordsRemaining = words.filter(w => wordAssignments[w] === player.team && !newRevealedWords.includes(w)).length;
      if (teamWordsRemaining === 0) {
        await supabase.from('games').update({
          revealed_words: newRevealedWords,
          status: 'finished',
          winner: player.team,
          current_phase: 'game_over',
        }).eq('id', gameId);

        return new Response(JSON.stringify({ success: true, action: 'win', winner: player.team, guess: matchedWord }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if opposing team won
      const opposingTeam = player.team === 'red' ? 'blue' : 'red';
      const opposingWordsRemaining = words.filter(w => wordAssignments[w] === opposingTeam && !newRevealedWords.includes(w)).length;
      if (opposingWordsRemaining === 0) {
        await supabase.from('games').update({
          revealed_words: newRevealedWords,
          status: 'finished',
          winner: opposingTeam,
          current_phase: 'game_over',
        }).eq('id', gameId);

        return new Response(JSON.stringify({ success: true, action: 'opponent_win', winner: opposingTeam, guess: matchedWord }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Continue turn or end turn based on guess result
      if (wordType === player.team) {
        const newGuessesRemaining = (game.guesses_remaining || 1) - 1;
        if (newGuessesRemaining > 0) {
          await supabase.from('games').update({
            revealed_words: newRevealedWords,
            guesses_remaining: newGuessesRemaining,
          }).eq('id', gameId);

          return new Response(JSON.stringify({ success: true, action: 'correct', guess: matchedWord, guessesRemaining: newGuessesRemaining }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Wrong guess or out of guesses - end turn
      const nextTeam = player.team === 'red' ? 'blue' : 'red';
      await supabase.from('games').update({
        revealed_words: newRevealedWords,
        current_team: nextTeam,
        current_phase: 'spymaster_clue',
        current_clue: null,
        current_clue_number: null,
        guesses_remaining: null,
      }).eq('id', gameId);

      return new Response(JSON.stringify({ success: true, action: wordType === player.team ? 'turn_end' : 'wrong', guess: matchedWord, nextTeam }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Vellum agent error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function callVellumAgent(apiKey: string, agentId: string, prompt: string): Promise<string> {
  // Use non-streaming endpoint with 30 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://predict.vellum.ai/v1/execute-workflow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        workflow_deployment_id: agentId,
        inputs: [
          {
            name: 'input',
            type: 'STRING',
            value: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Vellum API error:', response.status, errorText);
      throw new Error(`Vellum API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Vellum response:', JSON.stringify(result, null, 2).slice(0, 1000));

    // Extract output from the workflow execution result
    // The response structure is: { data: { outputs: [{ name: string, value: string }] } }
    const outputs = result.data?.outputs || [];
    
    // Find the output with the response (commonly named "output" or "final_output")
    for (const output of outputs) {
      if (output.value && typeof output.value === 'string') {
        console.log(`Found output "${output.name}":`, output.value.slice(0, 500));
        return output.value;
      }
    }

    // If no string output found, try to find any output with a value property
    for (const output of outputs) {
      if (output.value?.value && typeof output.value.value === 'string') {
        console.log(`Found nested output "${output.name}":`, output.value.value.slice(0, 500));
        return output.value.value;
      }
    }

    // Fallback: stringify all outputs for debugging
    console.error('Could not find string output in Vellum response. Outputs:', JSON.stringify(outputs));
    throw new Error('No valid output found in Vellum response');
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Vellum API request timed out after 30 seconds');
    }
    throw error;
  }
}
