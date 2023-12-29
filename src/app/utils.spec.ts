import { Uuid } from './uuid';

describe('Utils', () => {
  it('should create an instance', () => {
    expect(new Uuid()).toBeTruthy();
  });
});
