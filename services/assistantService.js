const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");

const azureIdentitySettingNames = [
  "AZURE_TENANT_ID",
  "AZURE_CLIENT_ID",
  "AZURE_CLIENT_SECRET"
];
const azureOpenAISettingNames = [
  "AZURE_OPENAI_ENDPOINT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_DEPLOYMENT"
];
const azureOpenAIApiVersion = process.env.OPENAI_API_VERSION || "2024-10-21";
const agentName = process.env.FOUNDRY_AGENT_NAME ||
  "computerandlaptopsalesandserviceagent";
const assistantInstructions = [
  "You are the Master Solutions customer-support assistant for a computer sales and services business in Fujairah, UAE.",
  "Answer clearly and helpfully about computer products, sales, and services.",
  "Do not invent prices, stock availability, policies, or order details. If you do not know, say so and direct the customer to contact the shop."
].join(" ");

let openAIClient;

function getFoundryConfig() {
  const endpoint = process.env.FOUNDRY_PROJECT_ENDPOINT;
  if (!endpoint) return null;

  return {
    endpoint: endpoint.replace(/\/+$/, ""),
    agentName
  };
}

function getAzureOpenAIConfig() {
  const configuredSettings = azureOpenAISettingNames
    .filter((name) => process.env[name]);
  if (configuredSettings.length === 0) return null;

  const missingSettings = azureOpenAISettingNames
    .filter((name) => !process.env[name]);
  if (missingSettings.length > 0) {
    throw new Error(`Missing Azure OpenAI configuration: ${missingSettings.join(", ")}`);
  }

  return {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT.replace(/\/+$/, ""),
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT
  };
}

function getAzureCredential() {
  const missingSettings = azureIdentitySettingNames
    .filter((name) => !process.env[name]);
  if (process.env.VERCEL && missingSettings.length > 0) {
    throw new Error(
      `Azure AI agent authentication is not configured in Vercel: missing ${missingSettings.join(", ")}.`
    );
  }

  return new DefaultAzureCredential();
}

function getOpenAIClient(config) {
  if (!openAIClient) {
    const projectClient = new AIProjectClient(
      config.endpoint,
      getAzureCredential()
    );
    openAIClient = projectClient.getOpenAIClient();
  }
  return openAIClient;
}

async function replyWithAzureOpenAI(conversationMessages, message, config) {
  const messages = [
    { role: "system", content: assistantInstructions },
    ...conversationMessages,
    { role: "user", content: message }
  ];
  const isV1Endpoint = /\/openai\/v1\/?$/i.test(new URL(config.endpoint).pathname);
  const url = isV1Endpoint
    ? new URL("chat/completions", `${config.endpoint.replace(/\/+$/, "")}/`)
    : new URL(
      `/openai/deployments/${encodeURIComponent(config.deployment)}/chat/completions`,
      `${config.endpoint}/`
    );
  const requestBody = { messages };
  if (isV1Endpoint) {
    requestBody.model = config.deployment;
  } else {
    url.searchParams.set("api-version", azureOpenAIApiVersion);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": config.apiKey
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    throw new Error(`Azure OpenAI request failed (HTTP ${response.status}).`);
  }

  const result = await response.json();
  const assistantReply = result.choices?.[0]?.message?.content;
  if (typeof assistantReply !== "string" || !assistantReply.trim()) {
    throw new Error("The Azure OpenAI assistant returned no text.");
  }

  return {
    conversationMessages: [
      ...conversationMessages,
      { role: "user", content: message },
      { role: "assistant", content: assistantReply.trim() }
    ].slice(-20),
    reply: assistantReply.trim()
  };
}

async function replyWithFoundryAgent(conversationId, message, config) {
  const client = getOpenAIClient(config);
  let activeConversationId = conversationId;

  if (activeConversationId) {
    await client.conversations.items.create(activeConversationId, {
      items: [{ type: "message", role: "user", content: message }]
    });
  } else {
    const conversation = await client.conversations.create({
      items: [{ type: "message", role: "user", content: message }]
    });
    activeConversationId = conversation.id;
  }

  const response = await client.responses.create(
    { conversation: activeConversationId },
    { body: { agent: { name: config.agentName, type: "agent_reference" } } }
  );

  if (typeof response.output_text !== "string" || !response.output_text.trim()) {
    throw new Error("The AI assistant returned no text.");
  }

  return {
    conversationId: activeConversationId,
    reply: response.output_text.trim()
  };
}

async function reply(conversationId, message, conversationMessages = []) {
  const foundryConfig = getFoundryConfig();
  if (foundryConfig) {
    return replyWithFoundryAgent(conversationId, message, foundryConfig);
  }

  const azureOpenAIConfig = getAzureOpenAIConfig();
  if (azureOpenAIConfig) {
    return replyWithAzureOpenAI(conversationMessages, message, azureOpenAIConfig);
  }

  throw new Error(
    "Missing Azure AI configuration: set FOUNDRY_PROJECT_ENDPOINT or all Azure OpenAI settings."
  );
}

function isAuthenticationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /authentication failed|authentication is not configured|failed to get token|credential unavailable|authenticationerror/i
    .test(message);
}

module.exports = { reply, isAuthenticationError };
