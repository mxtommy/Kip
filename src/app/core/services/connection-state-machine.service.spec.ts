import { ConnectionStateMachine } from './connection-state-machine.service';

describe('ConnectionStateMachine', () => {
  let service: ConnectionStateMachine;

  beforeEach(() => {
    service = new ConnectionStateMachine();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate HTTP retry window from retry intervals', () => {
    const retryWindowMs = service.getHttpRetryWindowMs();

    expect(retryWindowMs).toBe(10000);
  });

  it('should add grace period to HTTP retry window', () => {
    const retryWindowMs = service.getHttpRetryWindowMs(2000);

    expect(retryWindowMs).toBe(12000);
  });
});
