import ora from 'ora'

const spinner = ora({
  // make a singleton so we don't ever have 2 spinners
  spinner: 'dots',
})

export const spinnerStart= (message) => {
  if (spinner.isSpinning) {
    spinner.text = message
    return
  }
  spinner.start(message)
}

export const spinnerStop = () => {
  if (spinner.isSpinning) {
    spinner.stop()
  }
}

export const spinnerError = (message) => {
  if (spinner.isSpinning) {
    spinner.fail(message)
  }
}
export const spinnerSuccess = (message) => {
  if (spinner.isSpinning) {
    spinner.succeed(message)
  }
}
export const spinnerInfo = (message) => {
  spinner.info(message)
}