import fs from 'node:fs/promises'
import path from 'node:path'
import { encoding_for_model } from '@dqbd/tiktoken'
import { APIRateLimit } from './APIRateLimit.js'
import {
  createCodeFileSummary,
  createCodeQuestions,
  folderSummaryPrompt,
} from './prompts.js'
import { traverseFileSystem } from './traverseFileSystem.js'
import {
	spinnerSuccess,
	spinnerStop,
	spinnerStart,
} from './spinners.js'
import { getFileName, githubFileUrl, githubFolderUrl } from './ghPath.js'
import { models } from './LLMUtil.js'
import CONST from '../const.js'

const processRepository = async (inputRoot, outputRoot, cfg, dryRun) => {
  const encoding = encoding_for_model(cfg.llms[0])
  const rateLimit = new APIRateLimit(25)

  const callLLM = async ( prompt, model) => rateLimit.callApi(() => model.call(prompt))

  const isModel = (model = null) => model !== null

  const processFile = async ({
    fileName,
    filePath,
    projectName,
    contentType,
    filePrompt,
    targetAudience,
    linkHosted,
  }) => {

    const content = await fs.readFile(filePath, 'utf-8')
    const summaryPrompt = createCodeFileSummary({
      projectName,
      projectName,
      content,
      contentType,
      filePrompt,
    })
    const questionsPrompt = createCodeQuestions({
      projectName,
      projectName,
      content,
      contentType,
      targetAudience,
    })
    const summaryLength = encoding.encode(summaryPrompt).length
    const questionLength = encoding.encode(questionsPrompt).length
    const max = Math.max(questionLength, summaryLength)

    /**
     * TODO: Encapsulate logic for selecting the best model
     * TODO: Allow for different selection strategies based
     * TODO: preference for cost/performace
     * TODO: When this is re-written, it should use the correct
     * TODO: TikToken encoding for each model
     */

    const model = (() => {
      if (models[CONST.GPT35_04K].maxLength > max && cfg.llms.includes(CONST.GPT35_04K)) {
        return models[CONST.GPT35_04K]
      } else if (models[CONST.GPT40_08K].maxLength > max && cfg.llms.includes(CONST.GPT40_08K)) {
        return models[CONST.GPT40_08K]
      } else if (models[CONST.GPT40_32K].maxLength > max && cfg.llms.includes(CONST.GPT40_32K)) {
        return models[CONST.GPT40_32K]
      } else {
        return null
      }
    })()

    if (!isModel(model)) {
      // console.log(`Skipped ${filePath} | Length ${max}`)
      return
    }

    try {
      if (!dryRun) {
        
        /** Call LLM */
        const [summary, questions] = await Promise.all([
          callLLM(summaryPrompt, model.llm),
          callLLM(questionsPrompt, model.llm),
        ])
        
        /**
         * Create file and save to disk
        */
        const url = githubFileUrl(cfg.repositoryUrl, inputRoot, filePath, linkHosted)
        const file = {
          fileName,
          filePath,
          url,
          summary,
          questions,
        }

        const markdownFilePath = path.join(outputRoot, filePath)
        const outputPath = getFileName(markdownFilePath, '.json')
        const content = file.summary.length > 0 ? JSON.stringify(file, null, 2) : ''

        /**
         * Create the output directory if it doesn't exist
         */
        try {
          await fs.mkdir(markdownFilePath.replace(fileName, ''), {
            recursive: true,
          })
          await fs.writeFile(outputPath, content, 'utf-8')
        } catch (error) {
          console.error(error)
          return
        }

        // console.log(`File: ${fileName} => ${outputPath}`)
      }

      /**
       * Track usage for end of run summary
       */
      model.inputTokens += summaryLength + questionLength
      model.total++
      model.outputTokens += 1000
      model.succeeded++
    } catch (e) {
      console.log(e)
      console.error(`Failed to get summary for file ${fileName}`)
      model.failed++
    }
  }

  const processFolder = async ({
    folderName,
    folderPath,
    projectName,
    contentType,
    folderPrompt,
    shouldIgnore,
    linkHosted,
  }) => {
    /**
     * For now we don't care about folders
     *
     * TODO: Add support for folders during estimation
     */
    if (dryRun) return

    const contents = (await fs.readdir(folderPath)).filter(
      (fileName) => !shouldIgnore(fileName),
    )
    // eslint-disable-next-line prettier/prettier
    const url = githubFolderUrl(cfg.repositoryUrl, inputRoot, folderPath, linkHosted)
    const allFiles = await Promise.all(
      contents.map(async (fileName) => {
        const entryPath = path.join(folderPath, fileName)
        const entryStats = await fs.stat(entryPath)

        if (entryStats.isFile() && fileName !== 'summary.json') {
          const file = await fs.readFile(entryPath, 'utf8')

          return file.length > 0 ? JSON.parse(file) : null
        }

        return null
      }),
    )

    try {
      const files = allFiles.filter(
        (file) => file !== null,
      )
      const allFolders = await Promise.all(
        contents.map(async (fileName) => {
          const entryPath = path.join(folderPath, fileName)
          const entryStats = await fs.stat(entryPath)

          if (entryStats.isDirectory()) {
            try {
              const summaryFilePath = path.resolve(entryPath, 'summary.json')
              const file = await fs.readFile(summaryFilePath, 'utf8')
              return JSON.parse(file)
            } catch (e) {
              console.log(`Skipped: ${folderPath}`)
              return null
            }
          }

          return null
        }),
      )

      const folders = allFolders.filter(
        (folder) => folder !== null,
      )

      const summary = await callLLM(
        folderSummaryPrompt({
          folderPath,
          projectName,
          files,
          folders,
          contentType,
          folderPrompt,
        }),
        models[CONST.GPT35_04K].llm,
      )

      const folderSummary = {
        folderName,
        folderPath,
        url,
        files,
        folders: folders.filter(Boolean),
        summary,
        questions: '',
      }

      const outputPath = path.join(folderPath, 'summary.json')
      await fs.writeFile(
        outputPath,
        JSON.stringify(folderSummary, null, 2),
        'utf-8',
      )

      // console.log(`Folder: ${folderName} => ${outputPath}`)
    } catch (e) {
      console.log(e)
      console.log(`Failed to get summary for folder: ${folderPath}`)
    }
  }

  /**
   * Get the number of files and folders in the project
   */

  const filesAndFolders = async () => {
    let files = 0
    let folders = 0

    await Promise.all([
      traverseFileSystem(inputRoot, Object.assign({
        processFile: () => {
          files++
          return Promise.resolve()
        },
        processFolder: () => {
          folders++
          return Promise.resolve()
        }
      }, cfg)),
    ])
    return {files, folders}
  }

  const { files, folders } = await filesAndFolders()

  /**
   * Create markdown files for each code file and folder in the project
   */

  spinnerStart(`Processing ${files} files...`)
  await traverseFileSystem(inputRoot, Object.assign({
    processFile,
  }, cfg))
  spinnerSuccess(`Processing ${files} files...`)

  /**
   * Create markdown summaries for each folder in the project
   */
  spinnerStart(`Processing ${folders} folders... `)
  await traverseFileSystem(outputRoot, Object.assign({
    processFolder,
  }, cfg))
  spinnerSuccess(`Processing ${folders} folders... `)
  spinnerStop()

  /**
   * Print results
   */
  return models
}

export default processRepository
