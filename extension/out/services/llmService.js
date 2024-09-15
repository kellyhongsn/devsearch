"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeLLMInput = analyzeLLMInput;
exports.queryLLMResponse = queryLLMResponse;
const promises_1 = __importDefault(require("fs/promises"));
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const openai_1 = require("openai");
async function getAPIKey(context, keyName) {
    return (await context.secrets.get(keyName)) || '';
}
// Upload files to vector store and return vector store ID
async function uploadFilesToVectorStore(files, client) {
    try {
        const uploadedFiles = await Promise.all(files.map(async (file) => {
            console.log(`Processing file: ${file.originalname}, Size: ${file.size} bytes`);
            const tempFilePath = path_1.default.join('/tmp', file.originalname);
            await promises_1.default.writeFile(tempFilePath, file.buffer);
            const uploadedFile = await client.files.create({
                file: (0, fs_1.createReadStream)(tempFilePath),
                purpose: 'assistants',
            });
            await promises_1.default.unlink(tempFilePath);
            console.log(`File uploaded: ${uploadedFile.id}`);
            return uploadedFile.id;
        }));
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
    }
    catch (error) {
        console.error('Error in uploadFilesToVectorStore:', error);
        throw error;
    }
}
async function createThreadWithSearchResults(userQuery, client) {
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
async function runAssistantAndGetAnalysis(assistantId, threadId, client) {
    const stream = client.beta.threads.runs.stream(threadId, {
        assistant_id: assistantId,
        instructions: "Please analyze the code files. First, return a detailed summary of what exactly is going \
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
async function analyzeLLMInput(context, userQuery, files) {
    const apiKey = await getAPIKey(context, 'OPENAI_API_KEY');
    const client = new openai_1.OpenAI({ apiKey });
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
        const vectorStoreId = await uploadFilesToVectorStore(files, client);
        console.log('Vector Store created:', vectorStoreId);
        // Step 3: Update the assistant to use the new Vector Store
        await client.beta.assistants.update(assistant.id, {
            tool_resources: { file_search: { vector_store_ids: [vectorStoreId] } },
        });
        console.log('Assistant updated with vector store');
        // Step 4: Create a thread and attach the search results
        const thread = await createThreadWithSearchResults(userQuery, client);
        console.log('Thread ID: ', thread.id);
        // Step 5: Run the assistant and get the useful results
        const analysis = await runAssistantAndGetAnalysis(assistant.id, thread.id, client);
        return analysis;
    }
    catch (error) {
        console.error('Error in analyzeLLMInput:', error);
        throw error;
    }
}
async function queryLLMResponse(context, userQuery, analysis, screenshots, initialResponse = null) {
    const apiKey = await getAPIKey(context, 'OPENAI_API_KEY');
    const client = new openai_1.OpenAI({ apiKey });
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
    }
    else {
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
    const queryResponse = response.choices[0].message.content || '';
    const extractedActions = await separateOutput(queryResponse, client);
    return { queryResponse: queryResponse, extractedActions: extractedActions };
}
// another function to separate addtional queries
async function separateOutput(output, client) {
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
        const actionQueries = response.choices[0].message.content?.trim() || '';
        return actionQueries;
    }
    catch (error) {
        console.error('Error with the OpenAI API:', error);
        throw error;
    }
}
//# sourceMappingURL=llmService.js.map