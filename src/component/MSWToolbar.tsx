import * as React from 'react';
import { rest } from 'msw';
import {
  SetupWorkerApi,
  MockedRequest,
  ResponseComposition,
  RestContext,
} from 'msw';
import { usePrevious } from './hooks';
import styles from './styles.module.css';
import { WorkerMode } from '../types';
import { get, modes, set } from '../helpers';
import { MSWToolbarProps } from '..';

/**
 * This is a simple toolbar that allows you to toggle MSW handlers in local development as well as easily invalidate all of the caches.
 *
 * Modes:
 *  - 'error' = will throw a Network Error on any request to our internal API
 *  - 'normal' = handlers behave as originally defined
 * Delay: Allows you to set a global delay for all requests
 */
export const MSWToolbar = ({
  children = <div />,
  isEnabled = false,
  apiUrl = '',
  actions,
  worker,
  prefix = '',
  className,
  ...props
}: MSWToolbarProps) => {
  if ((isEnabled && !worker) || (isEnabled && worker && !worker.start)) {
    console.warn(
      'Unable to load MSWToolbar due to the worker being undefined. Please pass in a worker instance from setupWorker(...handlers).'
    );
  }

  const workerRef = React.useRef<SetupWorkerApi>();

  const [isReady, setIsReady] = React.useState(isEnabled ? false : true);

  const [mode, setMode] = React.useState<WorkerMode>(
    get(prefix, 'mode', 'normal')
  );

  const lastWorkerStateFromStorage = get(prefix, 'status', 'disabled');

  const [workerEnabled, setWorkerEnabled] = React.useState(
    lastWorkerStateFromStorage === 'enabled'
  );

  const previousWorkerEnabled = usePrevious(workerEnabled);
  const hasChangedWorkerState =
    previousWorkerEnabled !== undefined &&
    workerEnabled !== previousWorkerEnabled;

  const [delay, setDelay] = React.useState(get(prefix, 'delay', '75'));

  React.useEffect(() => {
    if (!worker || !isEnabled || workerRef.current) return;

    const prepareWorker = async () => {
      if (workerEnabled) {
        worker.start();
      }
      workerRef.current = worker;
      setIsReady(true);
    };

    prepareWorker();
  }, [workerEnabled, isEnabled, worker]);

  React.useEffect(() => {
    if (workerRef.current && hasChangedWorkerState) {
      const action = workerEnabled ? 'start' : 'stop';

      workerRef.current[action]();

      set(prefix, 'status', workerEnabled ? 'enabled' : 'disabled');
    }
  }, [workerEnabled, hasChangedWorkerState, prefix]);

  React.useEffect(() => {
    set(prefix, 'mode', mode);

    switch (mode) {
      case 'normal':
        workerRef.current?.resetHandlers();
        return;
      case 'error':
        workerRef.current?.use(
          ...['get', 'post', 'put', 'patch', 'delete'].map(method =>
            (rest as any)[method as any](
              `${apiUrl}/*`,
              (
                _req: MockedRequest<any>,
                res: ResponseComposition<any>,
                _ctx: RestContext
              ) => {
                return res.networkError('Fake error');
              }
            )
          )
        );
        return;
      default:
        return;
    }
  }, [mode, isReady, apiUrl, prefix]);

  React.useEffect(() => {
    set(prefix, 'delay', String(delay));
  }, [delay, prefix]);

  const [isHidden, setIsHidden] = React.useState(false);

  if (!isEnabled || !worker) return <>{children}</>;

  if (!isReady) {
    return null;
  }

  return (
    <>
      <div className={styles['container']} data-hidden={isHidden}>
        <div
          className={[className, styles['msw-toolbar']]
            .filter(Boolean)
            .join(' ')}
          {...props}
        >
          <label
            className={`${styles.toggle} ${styles['input-wrapper']}`}
            htmlFor="msw-toolbar-mocks-toggle"
          >
            <span className={styles.label}>Mocks:</span>

            <div data-toggle-checkbox-container>
              <input
                id="msw-toolbar-mocks-toggle"
                type="checkbox"
                tabIndex={0}
                onChange={() => setWorkerEnabled(prev => !prev)}
                checked={workerEnabled}
              />
              <div data-toggle-track />
              <div data-toggle-handle />
            </div>
          </label>

          <div className={styles['input-wrapper']}>
            <label className={styles.label} htmlFor="msw-toolbar-mode">
              Mode:
            </label>

            <select
              id="msw-toolbar-mode"
              value={mode}
              onChange={event => setMode(event.target.value as WorkerMode)}
            >
              {modes.map(m => (
                <option value={m} key={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className={styles['input-wrapper']}>
            <label className={styles.label} htmlFor="msw-toolbar-delay">
              Delay (ms):
            </label>

            <input
              id="msw-toolbar-delay"
              type="number"
              onChange={event => setDelay(event.target.value)}
              value={delay}
            />
          </div>

          <div className={styles.spacer} />

          {actions ? <div>{actions}</div> : null}
        </div>

        <button
          className={styles['hide-show-handle']}
          onClick={() => setIsHidden(isHidden => !isHidden)}
        >
          {isHidden ? (
            <svg
              className={styles.icon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 13l-7 7-7-7m14-8l-7 7-7-7"
              />
            </svg>
          ) : (
            <svg
              className={styles.icon}
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 11l7-7 7 7M5 19l7-7 7 7"
              />
            </svg>
          )}
        </button>
      </div>

      {children}
    </>
  );
};
