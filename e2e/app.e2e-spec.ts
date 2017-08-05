import { SailmonitorPage } from './app.po';

describe('sailmonitor App', () => {
  let page: SailmonitorPage;

  beforeEach(() => {
    page = new SailmonitorPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!');
  });
});
