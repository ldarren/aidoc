import { OpenAIChat } from 'langchain/llms'
import CONST from '../const.js'

export const models = {
  [CONST.GPT35_04K]: {
    name: CONST.GPT35_04K,
    inputCostPer1KTokens: 0.002,
    outputCostPer1KTokens: 0.002,
    maxLength: 3050,
    llm: new OpenAIChat({
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: CONST.GPT35_04K,
    }),
    inputTokens: 0,
    outputTokens: 0,
    succeeded: 0,
    failed: 0,
    total: 0,
  },
  [CONST.GPT40_08K]: {
    name: CONST.GPT40_08K,
    inputCostPer1KTokens: 0.03,
    outputCostPer1KTokens: 0.06,
    maxLength: 8192,
    llm: new OpenAIChat({
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: CONST.GPT40_08K,
    }),
    inputTokens: 0,
    outputTokens: 0,
    succeeded: 0,
    failed: 0,
    total: 0,
  },
  [CONST.GPT40_32K]: {
    name: CONST.GPT40_32K,
    inputCostPer1KTokens: 0.06,
    outputCostPer1KTokens: 0.12,
    maxLength: 32768,
    llm: new OpenAIChat({
      temperature: 0.1,
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: CONST.GPT40_32K,
    }),
    inputTokens: 0,
    outputTokens: 0,
    succeeded: 0,
    failed: 0,
    total: 0,
  },
};

export const printModelDetails = (models) => {
	const output = models.map((model) => {
	  return {
		Model: model.name,
		'File Count': model.total,
		Succeeded: model.succeeded,
		Failed: model.failed,
		Tokens: model.inputTokens + model.outputTokens,
		Cost:
		  (model.total / 1000) * model.inputCostPer1KTokens +
		  (model.outputTokens / 1000) * model.outputCostPer1KTokens,
	  };
	});
  
	const totals = output.reduce((cur, next) => ({
		...cur,
		'File Count': cur['File Count'] + next['File Count'],
		Succeeded: cur.Succeeded + next.Succeeded,
		Failed: cur.Failed + next.Failed,
		Tokens: cur.Tokens + next.Tokens,
		Cost: cur.Cost + next.Cost,
	}), {
		Model: 'Total',
		'File Count': 0,
		Succeeded: 0,
		Failed: 0,
		Tokens: 0,
		Cost: 0,
	})
  
	const all = [...output, totals];
	console.table(all);
}

export const totalIndexCostEstimate = (models) => {
	const totalCost = models.reduce((cur, model) => {
		return (
		cur +
		(model.total / 1000) * model.inputCostPer1KTokens +
		(model.outputTokens / 1000) * model.outputCostPer1KTokens
		)
	}, 0)

	return totalCost
}