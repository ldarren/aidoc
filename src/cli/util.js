import chalk from 'chalk'
import inquirer from 'inquirer'

export const displayWelcomeMessage = (projectName) => {
	console.log(chalk.bold.blue(`Welcome to the ${projectName} chatbot.`));
	console.log(
		`Ask any questions related to the ${projectName} codebase, and I'll try to help. Type 'exit' to quit.\n`,
	)
}

export const clearScreenAndMoveCursorToTop = () => {
	process.stdout.write('\x1B[2J\x1B[0f')
}

export const getQuestion = async (name) => {
	const { question } = await inquirer.prompt([
		{
			type: 'input',
			name: 'question',
			message: chalk.yellow(`How can I help with ${name}?\n`),
		},
	]);

	return question;
};
