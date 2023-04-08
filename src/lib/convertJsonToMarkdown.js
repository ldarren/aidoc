import fs from 'node:fs/promises'
import path from 'path'
import { traverseFileSystem } from './traverseFileSystem.js'
import { spinnerSuccess, spinnerStart } from './spinners.js'
import { getFileName } from './ghPath.js'

export const convertJsonToMarkdown = async (inputRoot, outputRoot, cfg) => {
  /**
   * Count the number of files in the project
   */
  let files = 0
  await traverseFileSystem(inputRoot, Object.assign({}, cfg, {
    processFile: () => {
      files++
      return Promise.resolve()
    },
    ignore: [],
  }))

  /**
   * Create markdown files for each code file in the project
   */

  const processFile = async ({fileName, filePath}) => {
    const content = await fs.readFile(filePath, 'utf-8')

    // TODO: Handle error
    if (!content) return

    const markdownFilePath = path
      .join(outputRoot, filePath)
      .replace(inputRoot, '')

    /**
     * Create the output directory if it doesn't exist
     */
    try {
      await fs.mkdir(markdownFilePath.replace(fileName, ''), {
        recursive: true,
      })
    } catch (error) {
      console.error(error)
      return
    }

    const { url, summary, questions } =
      fileName === 'summary.json'
        ? (JSON.parse(content))
        : (JSON.parse(content))

    /**
     * Only include the file if it has a summary
     */
    const markdown =
      summary.length > 0
        ? `[View code on GitHub](${url})\n\n${summary}\n${
            questions ? '## Questions: \n ' + questions : ''
          }`
        : ''

    const outputPath = getFileName(markdownFilePath, '.md')
    await fs.writeFile(outputPath, markdown, 'utf-8')
  }

 spinnerStart(`Creating ${files} mardown files...`)
  await traverseFileSystem(inputRoot, Object.assign({}, cfg, {
    processFile,
    ignore: [],
  }))
  spinnerSuccess(`Created ${files} mardown files...`)
}
