import { useEffect, useRef, useState } from 'react'

export function CliPage() {
  const [command, setCommand] = useState('')
  const [running, setRunning] = useState(false)
  const [history, setHistory] = useState([])
  const [requestError, setRequestError] = useState('')
  const terminalBodyRef = useRef(null)

  useEffect(() => {
    if (!terminalBodyRef.current) return
    terminalBodyRef.current.scrollTop = terminalBodyRef.current.scrollHeight
  }, [history, running, requestError])

  const runCommand = async () => {
    if (running) return
    const trimmed = command.trim()
    if (!trimmed) return

    setRequestError('')
    setRunning(true)

    try {
      const res = await fetch('/api/cli/nats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ command: trimmed }),
      })
      const raw = await res.text()
      let data = null
      if (raw) {
        try {
          data = JSON.parse(raw)
        } catch {
          setRequestError(`Unexpected response from server (status ${res.status}).`)
          setHistory((prev) => [
            ...prev,
            {
              command: trimmed,
              ok: false,
              exitCode: null,
              durationMs: 0,
              stdout: '',
              stderr: `Unexpected response from server (status ${res.status}).`,
              validationError: null,
              timestamp: new Date().toLocaleTimeString(),
            },
          ])
          return
        }
      }

      if (!res.ok) {
        const errorMessage = data?.validationError || data?.error || `Request failed with status ${res.status}.`
        setHistory((prev) => [
          ...prev,
          {
            command: trimmed,
            ok: false,
            exitCode: data?.exitCode ?? null,
            durationMs: data?.durationMs ?? 0,
            stdout: data?.stdout || '',
            stderr: data?.stderr || (!data?.validationError ? errorMessage : ''),
            validationError: data?.validationError || null,
            timestamp: new Date().toLocaleTimeString(),
          },
        ])
        if (!data?.validationError) setRequestError(errorMessage)
      } else {
        if (!data) {
          setRequestError(`Empty response from server (status ${res.status}).`)
          setHistory((prev) => [
            ...prev,
            {
              command: trimmed,
              ok: false,
              exitCode: null,
              durationMs: 0,
              stdout: '',
              stderr: `Empty response from server (status ${res.status}).`,
              validationError: null,
              timestamp: new Date().toLocaleTimeString(),
            },
          ])
          return
        }
        setHistory((prev) => [
          ...prev,
          {
            command: trimmed,
            ok: data.ok,
            exitCode: data.exitCode ?? null,
            durationMs: data.durationMs ?? 0,
            stdout: data.stdout || '',
            stderr: data.stderr || '',
            validationError: data.validationError || null,
            timestamp: new Date().toLocaleTimeString(),
          },
        ])
      }
      setCommand('')
    } catch (err) {
      setRequestError(err.message || 'Failed to execute command.')
      setHistory((prev) => [
        ...prev,
        {
          command: trimmed,
          ok: false,
          exitCode: null,
          durationMs: 0,
          stdout: '',
          stderr: err.message || 'Failed to execute command.',
          validationError: null,
          timestamp: new Date().toLocaleTimeString(),
        },
      ])
    } finally {
      setRunning(false)
    }
  }

  const onCommandKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      runCommand()
    }
  }

  const clearTerminal = () => {
    setHistory([])
    setRequestError('')
  }

  return (
    <div className="-m-6 h-[calc(100vh-4rem)] bg-[#0b1020] text-[#c6d0f5]">
      <div className="flex h-full flex-col border-y border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
          <div className="text-xs font-mono uppercase tracking-wider text-[#8aadf4]">
            NATS Terminal - Non-interactive mode (nats only)
          </div>
          <button
            type="button"
            onClick={clearTerminal}
            className="rounded border border-white/20 px-2 py-1 text-xs font-mono text-[#8aadf4] transition-colors hover:bg-white/10"
          >
            clear
          </button>
        </div>

        <div ref={terminalBodyRef} className="flex-1 overflow-auto px-4 py-3 font-mono text-sm">
          {history.length === 0 && (
            <div className="space-y-1 text-[#9fb2e7]">
              <div>Type a command and press Enter.</div>
              <div>Examples: <span className="text-[#a6da95]">nats --help</span>, <span className="text-[#a6da95]">nats stream ls</span></div>
            </div>
          )}

          {history.map((entry, idx) => (
            <div key={`${entry.timestamp}-${idx}`} className="mb-5 space-y-2">
              <div className="flex items-center gap-2 text-[#8aadf4]">
                <span>$</span>
                <span className="break-all text-[#a6da95]">{entry.command}</span>
                <span className="text-xs text-[#7f849c]">{entry.timestamp}</span>
              </div>

              {entry.validationError ? (
                <div className="rounded border border-[#f5a97f]/40 bg-[#f5a97f]/10 p-2 text-[#f5a97f]">
                  blocked: {entry.validationError}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs text-[#7f849c]">
                    status={entry.ok ? 'success' : 'failed'} exit={entry.exitCode ?? 'n/a'} duration={entry.durationMs}ms
                  </div>
                  {entry.stdout && (
                    <pre className="whitespace-pre-wrap rounded border border-white/10 bg-black/20 p-2 text-[#cad3f5]">{entry.stdout}</pre>
                  )}
                  {entry.stderr && (
                    <pre className="whitespace-pre-wrap rounded border border-[#ed8796]/35 bg-[#ed8796]/10 p-2 text-[#ed8796]">{entry.stderr}</pre>
                  )}
                  {!entry.stdout && !entry.stderr && (
                    <div className="text-[#7f849c]">No output</div>
                  )}
                </div>
              )}
            </div>
          ))}

          {requestError && (
            <div className="rounded border border-[#ed8796]/35 bg-[#ed8796]/10 p-2 text-[#ed8796]">
              {requestError}
            </div>
          )}
          {running && (
            <div className="mt-2 animate-pulse text-[#8aadf4]">Running...</div>
          )}
          <div className="mt-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-2">
              <span className="text-[#8aadf4]">$</span>
              <input
                id="cli-command"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={onCommandKeyDown}
                placeholder="nats stream ls"
                className="w-full bg-transparent text-[#cad3f5] outline-none placeholder:text-[#7f849c]"
                disabled={running}
                autoFocus
              />
            </div>
            <div className="mt-1 text-xs text-[#7f849c]">
              Enter to run. Allowed: nats commands only. No shell chaining/operators.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
