import fs from 'node:fs/promises'
import path from 'path'
import minimatch from 'minimatch'
import { isText } from 'istextorbinary'

export const traverseFileSystem = async (inputPath, {
	name: projectName,
	processFile,
	processFolder,
	ignore,
	filePrompt,
	folderPrompt,
	contentType,
	targetAudience,
	linkHosted
}) => {
  try {
    try {
      await fs.access(inputPath)
    } catch (error) {
      console.error(`The provided ${inputPath} path does not exist.`)
      return
    }

    const shouldIgnore = (filePath) => {
      return ignore.some((pattern) => minimatch(filePath, pattern))
    }

    const dfs = async (currentPath) => {
      const contents = (await fs.readdir(currentPath)).filter(
        (fileName) => !shouldIgnore(path.join(currentPath, fileName)),
      )

      await Promise.all(
        contents.map(async (nodeName) => {
          const nodePath = path.join(currentPath, nodeName)

          const entryStats = await fs.stat(nodePath)

          if (entryStats.isDirectory()) {
            await dfs(nodePath)

            await processFolder?.({
              folderName: nodeName,
              folderPath: nodePath,
              projectName,
              shouldIgnore,
              folderPrompt,
              contentType,
              targetAudience,
              linkHosted,
            })
          }
          if (entryStats.isFile() && isText(nodeName)) {

            await processFile?.({
              fileName: nodeName,
              filePath: nodePath,
              projectName,
              filePrompt,
              contentType,
              targetAudience,
              linkHosted,
            })
          }
        })
      )
    }

    await dfs(inputPath)
  } catch (e) {
    console.error(`Error during traverseFileSystem: ${e.message}`)
    throw e
  }
}
