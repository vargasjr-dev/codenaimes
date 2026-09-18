"use client";

import { ArrowLeft, Users, Zap, Link2, Bot } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const HowTo = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back Link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-4">
            How to <span className="text-primary">Play</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Everything you need to set up a room and start playing CodenAImes.
          </p>
        </div>

        {/* Creating a room */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Creating a Room
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              From the home page, enter your name and hit <strong>Play as Guest</strong> — no
              account required. Then click <strong>Create Room</strong>.
            </p>
            <p>
              Once the room is created, use the <strong>Share</strong> button to copy an invite
              link. Anyone with the link can join the room without making an account — they just
              enter their name.
            </p>
          </CardContent>
        </Card>

        {/* Playing with Jev */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />
              Playing with Jev
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Don't have four people? Add <strong>Jev</strong> — an AI player powered by TypeSafe's
              System One model — to any open seat. In the join panel, pick a team and click{" "}
              <strong>Add Jev Agent to Team</strong>.
            </p>
            <p>
              Jev plays both roles: as Spymaster it picks the strongest legal clue from a candidate
              word list, and as Operative it chooses which board word to guess (or passes). It
              reasons with calibrated probabilities, so expect measured, conservative play.
            </p>
          </CardContent>
        </Card>

        {/* Game rules */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              The Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground">
            <p>
              Two teams of two. On each team, the <strong>Spymaster</strong> sees the secret
              identities of the 25 board words and gives a one-word clue plus a number. The{" "}
              <strong>Operative</strong> then guesses which words the clue points to.
            </p>
            <p>
              Guess your team's words to reveal them. Hit an opposing word and your turn ends
              early; hit a neutral word and your turn ends; hit the <strong>assassin</strong> word
              and your team loses instantly. First team to reveal all of its words wins.
            </p>
            <p>
              Teams may have a human or Jev in either seat — mix and match however you like.
            </p>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/">
            <Button size="lg" className="gap-2">
              <Link2 className="w-4 h-4" />
              Create a Room
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowTo;
