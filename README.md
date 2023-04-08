## Setup
- export OPENAI\_API\_KEY=sk\_xxxx
- ./aidoc.js init
- ./aidoc.js estimation
- ./aidoc.js index
- ./aidoc.js q 'quesiton'

## Dependencies
- @dqbd/tiktoken: LLM token encoding
- chalk: colour text in terminal
- commander: CLI tools
- inquirer: CLI Q&A
- ora: CLI spinners
- minimatch: file pattern mactching
- istextorbinary: Determine if a filename and/or buffer is text or binary. 
- langchain: beat the LLM token limit
- hnswlib-node: search nearest neighbour:w
