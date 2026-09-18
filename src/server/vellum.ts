export async function callVellumAgent(apiKey: string, agentId: string, prompt: string): Promise<string> {
  // Use non-streaming endpoint with 30 second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://predict.vellum.ai/v1/execute-workflow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        workflow_deployment_id: agentId,
        inputs: [
          {
            name: "input",
            type: "STRING",
            value: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vellum API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    // The response structure is: { data: { outputs: [{ name: string, value: string }] } }
    const outputs = result.data?.outputs ?? [];

    for (const output of outputs) {
      if (output.value && typeof output.value === "string") {
        return output.value;
      }
    }

    for (const output of outputs) {
      if (output.value?.value && typeof output.value.value === "string") {
        return output.value.value;
      }
    }

    throw new Error("No valid output found in Vellum response");
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Vellum API request timed out after 30 seconds");
    }
    throw error;
  }
}
