-- Log-to-event causal links. Consequence logs carry a pointer back to the
-- event that caused them so the frontend can draw cause->effect connectors.
ALTER TABLE logs
  ADD COLUMN IF NOT EXISTS cause_event_id INT REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_logs_cause_event ON logs(cause_event_id);
