"use strict";
// import { expect } from 'chai';
// import * as sinon from 'sinon';
// import { performWebAction } from '../src/services/webInteractionService';
// import { OpenAI } from 'openai';
// import axios from 'axios';
// import { scrapeAndScreenshot } from '../src/services/scrapeService';
// describe('webInteractionService', () => {
//   let mockContext: any;
//   let mockOpenAI: any;
//   let axiosStub: sinon.SinonStub;
//   let scrapeAndScreenshotStub: sinon.SinonStub;
//   beforeEach(() => {
//     mockContext = {
//       secrets: {
//         get: sinon.stub().resolves('mock-api-key'),
//       },
//     };
//     mockOpenAI = {
//       chat: {
//         completions: {
//           create: sinon.stub().resolves({
//             choices: [{ message: { content: 'https://example.com/relevant' } }],
//           }),
//         },
//       },
//     };
//     sinon.stub(OpenAI.prototype, 'constructor' as any).returns(mockOpenAI);
//     axiosStub = sinon.stub(axios, 'get').resolves({ data: '<html>Mock HTML</html>' });
//     scrapeAndScreenshotStub = sinon.stub(scrapeAndScreenshot as any).resolves([
//       { id: 1, link: 'https://example.com/relevant', screenshot: 'base64screenshot' },
//     ]);
//   });
//   afterEach(() => {
//     sinon.restore();
//   });
//   it('should perform web action and return result', async () => {
//     const result = await performWebAction(mockContext, 'https://example.com', 'test query');
//     expect(result).to.deep.equal({
//       link: 'https://example.com/relevant',
//       screenshot: 'base64screenshot',
//     });
//     expect(mockContext.secrets.get.calledWith('OPENAI_API_KEY')).to.be.true;
//     expect(axiosStub.calledWith('https://example.com')).to.be.true;
//     expect(mockOpenAI.chat.completions.create.called).to.be.true;
//     expect(scrapeAndScreenshotStub.called).to.be.true;
//   });
//   it('should throw an error if no relevant link is found', async () => {
//     mockOpenAI.chat.completions.create.returns(Promise.resolve({
//       choices: [{ message: { content: '' } }],
//     }));
//     await expect(performWebAction(mockContext, 'https://example.com', 'test query')).to.be.rejectedWith(
//       'No relevant link found'
//     );
//   });
// });
//# sourceMappingURL=webInteractionService.test.js.map