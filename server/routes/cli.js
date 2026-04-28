import { runNatsCommand, validateAndParseNatsCommand } from '../services/cli.js'

export function registerCliRoutes(router, { readJsonBody }) {
  router.post('/api/cli/nats', async (req, res) => {
    res.setHeader('Content-Type', 'application/json')

    try {
      const body = await readJsonBody(req)
      const validation = validateAndParseNatsCommand(body?.command)

      if (!validation.valid) {
        res.statusCode = 400
        res.end(JSON.stringify({
          ok: false,
          validationError: validation.error,
        }))
        return
      }

      const result = await runNatsCommand(validation.args)
      res.statusCode = 200
      res.end(JSON.stringify(result))
    } catch (err) {
      res.statusCode = 500
      res.end(JSON.stringify({
        ok: false,
        error: err.message || 'Failed to run command.',
      }))
    }
  })
}
