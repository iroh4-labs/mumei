import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/setup'
import { ReliabilityTab } from './ReliabilityTab'

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ReliabilityTab />
    </QueryClientProvider>,
  )
}

describe('ReliabilityTab', () => {
  it('renders the empty state when features[] is empty (REQ-25.4.1)', async () => {
    renderTab()
    await waitFor(() => {
      expect(
        screen.getByText('No reliability data yet. Run /mumei:proceed on a feature.'),
      ).toBeInTheDocument()
    })
  })

  it('renders a table with one row per feature (normal path)', async () => {
    server.use(
      http.get('/api/reliability', () =>
        HttpResponse.json({
          features: [
            {
              feature: 'REQ-25-reliability-tracking',
              vehicle: 'spec',
              n_trials: 5,
              k: 3,
              window: 10,
              pass_rate: 0.6,
              evaluable: true,
              last_updated: '2026-05-25T10:30:45Z',
              recent: [
                {
                  feature: 'REQ-25-reliability-tracking',
                  wave: '1',
                  task_id: '1.1',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:40Z',
                },
                {
                  feature: 'REQ-25-reliability-tracking',
                  wave: '1',
                  task_id: '1.2',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:41Z',
                },
                {
                  feature: 'REQ-25-reliability-tracking',
                  wave: '1',
                  task_id: '1.3',
                  trial_n: 1,
                  pass: false,
                  ts: '2026-05-25T10:30:42Z',
                },
                {
                  feature: 'REQ-25-reliability-tracking',
                  wave: '1',
                  task_id: '1.4',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:43Z',
                },
                {
                  feature: 'REQ-25-reliability-tracking',
                  wave: '1',
                  task_id: '1.5',
                  trial_n: 1,
                  pass: false,
                  ts: '2026-05-25T10:30:44Z',
                },
              ],
            },
          ],
        }),
      ),
    )
    renderTab()
    await waitFor(() => {
      expect(screen.getByText('REQ-25-reliability-tracking')).toBeInTheDocument()
    })
    expect(screen.getByText('0.60')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    // Sparkline carries an aria-label naming the trial count.
    expect(screen.getByRole('img', { name: /5 recent trials/ })).toBeInTheDocument()
  })

  it('REQ-25.4.2: renders "parse error" cell for feature with .error set, others normal', async () => {
    server.use(
      http.get('/api/reliability', () =>
        HttpResponse.json({
          features: [
            {
              feature: 'REQ-1-corrupt',
              vehicle: 'spec',
              n_trials: 0,
              k: 3,
              window: 10,
              pass_rate: 'N/A',
              evaluable: false,
              last_updated: null,
              recent: [],
              error: 'parse error: Unexpected token',
            },
            {
              feature: 'REQ-2-healthy',
              vehicle: 'spec',
              n_trials: 3,
              k: 3,
              window: 10,
              pass_rate: 1,
              evaluable: true,
              last_updated: '2026-05-25T10:30:45Z',
              recent: [
                {
                  feature: 'REQ-2-healthy',
                  wave: '1',
                  task_id: '1.1',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:43Z',
                },
                {
                  feature: 'REQ-2-healthy',
                  wave: '1',
                  task_id: '1.2',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:44Z',
                },
                {
                  feature: 'REQ-2-healthy',
                  wave: '1',
                  task_id: '1.3',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:45Z',
                },
              ],
            },
          ],
        }),
      ),
    )
    renderTab()
    await waitFor(() => {
      expect(screen.getByText('REQ-1-corrupt')).toBeInTheDocument()
    })
    expect(screen.getByText('parse error')).toBeInTheDocument()
    // Healthy feature still rendered alongside the corrupt one.
    expect(screen.getByText('REQ-2-healthy')).toBeInTheDocument()
    expect(screen.getByText('1.00')).toBeInTheDocument()
  })

  it('shows N/A for non-evaluable rows (n_trials < k)', async () => {
    server.use(
      http.get('/api/reliability', () =>
        HttpResponse.json({
          features: [
            {
              feature: 'REQ-1-tiny',
              vehicle: 'spec',
              n_trials: 2,
              k: 3,
              window: 10,
              pass_rate: 'N/A',
              evaluable: false,
              last_updated: '2026-05-25T10:30:45Z',
              recent: [
                {
                  feature: 'REQ-1-tiny',
                  wave: '1',
                  task_id: '1.1',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:44Z',
                },
                {
                  feature: 'REQ-1-tiny',
                  wave: '1',
                  task_id: '1.2',
                  trial_n: 1,
                  pass: true,
                  ts: '2026-05-25T10:30:45Z',
                },
              ],
            },
          ],
        }),
      ),
    )
    renderTab()
    await waitFor(() => {
      expect(screen.getByText('REQ-1-tiny')).toBeInTheDocument()
    })
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })
})
