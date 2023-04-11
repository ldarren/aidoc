import fs from 'node:fs/promises'
import path from 'node:path'
import chalk from 'chalk'
import inquirer from 'inquirer'
import {spinnerStart, spinnerSuccess} from '../lib/spinners.js'
import processRepository from '../lib/processRepository.js'
import {printModelDetails, totalIndexCostEstimate} from '../lib/LLMUtil.js'
import {convertJsonToMarkdown} from '../lib/convertJsonToMarkdown.js'
import {createVectorStore} from '../lib/createVectorStore.js'
import CONST from '../const.js'

function configTemplate(config = {}){
	return Object.assign({
		name: '',
		repositoryUrl: '',
		root: './',
		output: './.aidoc',
		llms: [CONST.GPT35_04K],
		ignore: [
			'.*',
			'*package-lock.json',
			'*package.json',
			'node_modules',
			'*dist*',
			'*build*',
			'*test*',
			'*.env',
			'*.svg',
			'*.md',
			'*.mdx',
			'*.toml',
			'aidoc.config.json',
		],
		filePrompt:
			'Write a detailed technical explanation of what this code does. \n\
			Focus on the high-level purpose of the code and how it may be used in the larger project.\n\
			Include code examples where appropriate. Keep you response between 100 and 300 words. \n\
			DO NOT RETURN MORE THAN 300 WORDS.\n\
			Output should be in markdown format.\n\
			Do not just list the methods and classes in this file.',
		folderPrompt:
			'Write a technical explanation of what the code in this file does\n\
			and how it might fit into the larger project or work with other parts of the project.\n\
			Give examples of how this code might be used. Include code examples where appropriate.\n\
			Be concise. Include any information that may be relevant to a developer who is curious about this code.\n\
			Keep you response under 400 words. Output should be in markdown format.\n\
			Do not just list the files and folders in this folder.',
		chatPrompt: '',
		contentType: 'code',
		targetAudience: 'smart developer',
		linkHosted: true,
	}, config)
}

async function readJSON(configPath) {
	const json = await fs.readFile(configPath, 'utf8')
	return JSON.parse(json)
}

export async function init(root, options){
	const configPath = path.join(root, options.config)
	let config
	try {
		await fs.stat(configPath)
		const questions = [
			{
				type: 'confirm',
				name: 'continue',
				message:
				`An "${options.config}" file already exists in this location. The existing configuration will be overwritten. Do you want to continue? `,
				default: false,
			},
		]
	
		const answers = await inquirer.prompt(questions)
		if (!answers.continue) {
			process.exit(0)
		}
		config = configTemplate(await readJSON(configPath))
	} catch (ex) {
		config = configTemplate()
	}
	
	const questions = [
		{
			type: 'input',
			name: 'name',
			message: chalk.yellow(`Enter the name of your repository:`),
			default: config.name,
		},
		{
			type: 'input',
			name: 'repositoryUrl',
			message: chalk.yellow(`Enter the GitHub URL of your repository:`),
			default: config.repositoryUrl,
		},
		{
			type: 'list',
			name: 'llms',
			message: chalk.yellow(
				`Select which LLMs you have access to (use GPT-3.5 Turbo if you aren't sure):`,
			),
			default: config.llms.length - 1,
			choices: [
				{
					name: 'GPT-3.5 Turbo',
					value: [CONST.GPT35_04K],
				}, {
					name: 'GPT-3.5 Turbo, GPT-4 8K (Early Access)',
					value: [CONST.GPT35_04K, CONST.GPT40_08K],
				}, {
					name: 'GPT-3.5 Turbo, GPT-4 8K (Early Access), GPT-4 32K (Early Access)',
					value: [CONST.GPT35_04K, CONST.GPT40_08K, CONST.GPT40_32K],
				},
			],
		},
	]
	
	const { name, repositoryUrl, llms } = await inquirer.prompt(questions)
	
	const newConfig = configTemplate({
		...config,
		name,
		repositoryUrl,
		llms,
	})
	await fs.writeFile(
		path.join(newConfig.root, options.config),
		JSON.stringify(newConfig, null, 2),
		'utf-8',
	)
	
	console.log(
		chalk.green('AIDoc initialized. Run `doc index` to get started.'),
	)
}

export async function estimate(root, options){
	const configPath = path.join(root, options.config)
	const cfg = await readJSON(configPath)

	spinnerStart('Estimating cost...')
	const runDetails = await processRepository(cfg.root, cfg.output, cfg, true)
	spinnerSuccess()
	printModelDetails(Object.values(runDetails))
	const total = totalIndexCostEstimate(Object.values(runDetails))
	console.log(chalk.redBright(
`Cost estimate to process this repository: $${total.toFixed(2)}
This is just an estimate. Actual cost may vary.
It recommended that you set a limit in your OpenAI account to prevent unexpected charges.`))
}

export async function index(_root, options){
	const configPath = path.join(_root, options.config)
	const cfg = await readJSON(configPath)
	const jsonDir = path.join(cfg.output, 'docs', 'json/')
	const markdownDir = path.join(cfg.output, 'docs', 'markdown/')
	const dataDir = path.join(cfg.output, 'docs', 'data/')
	
	/**
	 * Traverse the repository, call LLMS for each file,
	 * and create JSON files with the results.
	 */
	
	spinnerStart('Processing repository and creating json files...')
	await processRepository(cfg.root, jsonDir, cfg)
	spinnerSuccess()
	
	/**
	 * Create markdown files from JSON files
	 */
	spinnerStart('Creating markdown files...')
	await convertJsonToMarkdown(jsonDir, markdownDir, cfg)
	spinnerSuccess()
	
	spinnerStart('Create vector files...')
	await createVectorStore(markdownDir, dataDir, cfg)
	spinnerSuccess()
}