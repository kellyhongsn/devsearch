import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Upload files to vector store and return vector store ID
async function uploadFilesToVectorStore(files) {
  try {
    const uploadedFiles = await Promise.all(
      files.map(async (file) => {
        console.log(`Processing file: ${file.originalname}, Size: ${file.size} bytes`);

        const tempFilePath = path.join('/tmp', file.originalname);
        await fs.writeFile(tempFilePath, file.buffer);

        const uploadedFile = await client.files.create({
          file: createReadStream(tempFilePath),
          purpose: 'assistants',
        });
        await fs.unlink(tempFilePath);

        console.log(`File uploaded: ${uploadedFile.id}`);
        return uploadedFile.id;
      })
    );

    console.log('All files uploaded successfully');

    const vectorStore = await client.beta.vectorStores.create({
      name: 'Code Analysis Vector Store',
    });
    console.log('Vector store created:', vectorStore.id);

    await client.beta.vectorStores.fileBatches.createAndPoll(vectorStore.id, {
      file_ids: uploadedFiles,
    });
    console.log('Files added to vector store');

    return vectorStore.id;
  } catch (error) {
    console.error('Error in uploadFilesToVectorStore:', error);
    throw error;
  }
}

async function createThreadWithSearchResults(userQuery) {
  const thread = await client.beta.threads.create({
    messages: [
      {
        role: 'user',
        content: `Analyze the code files in relation to the user query: ${userQuery}.`,
      },
    ],
  });

  return thread;
}

async function runAssistantAndGetAnalysis(assistantId, threadId) {
  const stream = client.beta.threads.runs.stream(threadId, {
    assistant_id: assistantId,
    instructions:
      "Please analyze the code files. First, return a detailed summary of what exactly is going \
on in the code. \
Then, look at the search query and analyze the current code in relation to the query. \
Consider what the code is currently doing and how the query may be related to the code. \
Additionally, consider what the user may want to do that is related to the code, but not \
in either the query or the current code, for example, deploying the code, migrating, adding \
a new feature, etc. Also consider what packages/dependencies the code may be using and how \
this may be relevant to the user's query. For example, packages that can be used together \
or if specific versions would be required. Include any code snippets that would be relevant to the \
user's query.",
  });

  let output = '';

  return new Promise((resolve, reject) => {
    stream
      .on('textCreated', () => console.log('assistant >'))
      .on('toolCallCreated', (event) => console.log('assistant ' + event.type))
      .on('messageDone', (event) => {
        if (event.content[0].type === 'text') {
          output += event.content[0].text.value;
        }
      })
      .on('end', () => {
        console.log('Output: ', output);
        resolve(output);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

async function analyzeLLMInput(userQuery, files) {
  try {
    // Step 1: Create an assistant with file search
    const assistant = await client.beta.assistants.create({
      name: 'Code Query Assistant',
      instructions: 'Analyze the content of code files in relation to a user query',
      model: 'gpt-4o',
      tools: [{ type: 'file_search' }],
    });
    console.log('Assistant created:', assistant.id);

    // Step 2: Upload the code and package files to the vector store
    const vectorStoreId = await uploadFilesToVectorStore(files);
    console.log('Vector Store created:', vectorStoreId);

    // Step 3: Update the assistant to use the new Vector Store
    await client.beta.assistants.update(assistant.id, {
      tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
    });
    console.log('Assistant updated with vector store');

    // Step 4: Create a thread and attach the search results
    const thread = await createThreadWithSearchResults(userQuery);
    console.log('Thread ID: ', thread.id);

    // Step 5: Run the assistant and get the useful results
    const analysis = await runAssistantAndGetAnalysis(assistant.id, thread.id);

    return analysis;
  } catch (error) {
    console.error('Error in analyzeLLMInput:', error);
    throw error;
  }
}

async function queryLLMResponse(userQuery, analysis, screenshots, initialResponse = null) {
  let systemMessage;
  let textMessage = `User Query:${userQuery}\n\nAnalysis: ${analysis}\n\n`;
  if (initialResponse) {
    systemMessage =
      "You are an expert assistant that answers questions about code \
                and provides actionable steps to take. You will be given an analysis of the user's \
                code, the user's query, a past response to their query, and images of documentation, \
                code snippets, and other useful new context of the user's query since the past response. \
                Provide answers to the user's query, based on their code and the given context.";
    textMessage += `Past Response: ${initialResponse}\n\n`;
  } else {
    systemMessage =
      "You are an expert assistant that can answer questions about code \
                and provide actionable steps to take. You will be given an analysis of the user's \
                code, the user's query, and images of documentation, code snippets, and other useful \
                context that were queried from a search of the user's query. Provide answers to the user's query, based on their code and the given context.";
  }
  systemMessage +=
    "First, focus on the information you have and disregard the information you do not know \
                to try to answer the user's question to the best of your ability. \
                Then, if more information is needed and it is clear where to find it based on the images, \
                suggest specific actions to take. ";
  console.log('System Message: ', systemMessage);
  const messages = [
    {
      role: 'system',
      content: systemMessage,
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `${textMessage}
                Based on the analysis and the images, focus on the information you have and try \
                to answer the user query. If no further information is needed, just answer the user query. \
                If more information is needed and it is clear where to find it based on the images, \
                suggest specific actions to take.`,
        },
        ...screenshots.map((screenshot) => ({
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${screenshot.screenshot}`,
          },
        })),
      ],
    },
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    max_tokens: 2000,
  });

  const queryResponse = response.choices[0].message.content;

  const extractedActions = separateOutput(queryResponse);

  return { queryResponse: queryResponse, extractedActions: extractedActions };
}

// another function to separate addtional queries
async function separateOutput(output) {
  try {
    const prompt = `Extract the action queries from the following text (phrases like "Click on 'Getting Started' button" or "Go to 'About' link") and return them each separated by a new line:\n\n"${output}"`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt },
      ],
    });

    // Extract the content from the GPT response
    const actionQueries = response.choices[0].message.content.trim();

    return actionQueries;
  } catch (error) {
    console.error('Error with the OpenAI API:', error);
    throw error;
  }
}

module.exports = {
  analyzeLLMInput,
  queryLLMResponse
};