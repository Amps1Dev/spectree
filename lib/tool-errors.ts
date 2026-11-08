export class ToolExecutionError extends Error {
  constructor(message: string, public status = 500, public output = '') {
    super(message);
    this.name = 'ToolExecutionError';
  }
}
