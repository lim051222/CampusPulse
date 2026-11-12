import type { CommandRecord } from '../types'

export function CommandFeed({ command }: { command: CommandRecord | null }) {
  if (!command) {
    return <p className="muted small">No command sent yet. Command state is read back from the backend, never assumed.</p>
  }

  return (
    <div className={`command command-${command.status}`}>
      <span className={`pill pill-${command.status === 'acked' ? 'online' : command.status === 'pending' ? 'warn' : 'offline'}`}>
        {command.status.toUpperCase()}
      </span>
      <span>
        {command.type}
        {Object.keys(command.args).length > 0 ? ` ${JSON.stringify(command.args)}` : ''} → {command.device_id}
      </span>
      {command.error && <span className="error">{command.error}</span>}
      <span className="muted small">created {command.created_at}</span>
    </div>
  )
}
