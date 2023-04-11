import fs from 'node:fs/promises'
import path from 'node:path'
import { OpenAIEmbeddings } from 'langchain/embeddings'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { Document } from 'langchain/document'
import { HNSWLib } from './langchain/hnswlib.js'
import {models} from './LLMUtil.js'

async function processFile(filePath) {
  const pageContent = await fs.readFile(filePath, 'utf8')
  const metadata = { source: filePath }
  return new Document({pageContent, metadata})
}

async function processDirectory(directoryPath) {
  const docs = []
  let files
  try {
    files = await fs.readdir(directoryPath)
  } catch (err) {
    console.error(err)
    throw new Error(`Could not read directory: ${directoryPath}. Did you run \`sh download.sh\`?`)
  }
  for (const file of files) {
    const filePath = path.join(directoryPath, file)
    const stat = await fs.stat(filePath)
    if (stat.isDirectory()) {
      const nestedDocs = await processDirectory(filePath)
      docs.push(...nestedDocs)
    } else {
      const doc = await processFile(filePath)
      docs.push(doc)
    }
  }
  return docs
}

export const createVectorStore = async (inputRoot, outputRoot, cfg) => {
  const rawDocs = await processDirectory(inputRoot)
  const llm = models[cfg.llms[0]]
  /* Split the text into chunks */
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: llm.maxLength,
    chunkOverlap: 100,
  })
  const docs = await textSplitter.splitDocuments(rawDocs)
  /* Create the vectorstore */
  const vectorStore = await HNSWLib.fromDocuments(docs, new OpenAIEmbeddings())
  await vectorStore.save(outputRoot)
}
