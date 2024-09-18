# DevSearch

DevSearch is a VSCode extension developed as part of [Exa's](https://exa.ai/) retrieval hackathon. It performs web retrieval for code documentation and GitHub repositories to provide up-to-date and customized guidance for developers.

## Features

- Web retrieval using Exa's search API for GitHub repos
- Documentation and article search using Serper
- Considers user's code files, queries, and version dependencies
- Combines existing code context with newly retrieved information
- Particularly helpful for tasks beyond coding, such as using frameworks or deploying to servers

## Installation

1. Clone this repository
2. Open the project in VSCode
3. Run and debug the code to open a new VSCode window with the extension

## Configuration

You'll need to provide the following API keys:

- `EXA_API_KEY`
- `SERPER_API_KEY`
- `OPENAI_API_KEY`

## Usage

1. Upload your code files to the extension
2. Input your query
3. DevSearch will analyze your code, consider dependencies, and retrieve relevant information from the web
4. Review the customized guidance provided by the extension

## Note

This project is a work in progress. Updates and improvements will be made regularly.
