#!/usr/bin/env node
import { Command } from 'commander'
import chalk from 'chalk'
import inquirer from 'inquirer'
import {init, estimate, index} from './src/cli/index.js'
import {spinnerError, spinnerStop} from './src/lib/spinners.js'
const program = new Command()

program
  .name('aidoc')
  .description('CLI to create doc with AI')
  .version('0.1.0')

program.command('init')
  .description('Initialize repository by creating a `aidoc.config.json` file in the current directory.')
  .argument('[path]', 'working directory', './')
  .option('-c, --config <char>', 'aidoc config file path', './aidoc.config.json')
  .action(async (root, options) => {
    await init(root, options)
  })

program
  .command('estimate')
  .description('Estimate the cost of running `index` on your respository.')
  .argument('[path]', 'working directory', './')
  .option('-c, --config <char>', 'aidoc config file path', './aidoc.config.json')
  .option('-l, --limit-rate <rps>', 'rate limit (rps)', 25)
  .action(async (root, options) => {
    await estimate(root, options)
  })


  program
  .command('index')
  .description('Traverse your codebase, write docs via LLM, and create a locally stored index.')
  .argument('[path]', 'working directory', './')
  .option('-c, --config <char>', 'aidoc config file path', './aidoc.config.json')
  .option('-l, --limit-rate <rps>', 'rate limit (rps)', 25)
  .action(async (root, options) => {
    await estimate(root, options)
    const questions = [
      {
        type: 'confirm',
        name: 'continue',
        message: 'Do you want to continue with indexing?',
        default: true,
      },
    ]

    const answers = await inquirer.prompt(questions);

    if (answers.continue) {
      console.log(chalk.green('Starting crawl...'))
      index(root, options)
    } else {
      console.log('Exiting...')
      process.exit(0)
    }
  })

/**
 * Listen for unhandled promise rejections
 */
process.on('unhandledRejection', (err) => {
  console.error(err.stack)

  spinnerError() // show an error spinner
  spinnerStop() // stop the spinner
  program.error('', { exitCode: 1 }) // exit with error code 1
})

program.parse()
