import worker from "../src/index.js";
export const onRequest = ({ request }) => worker.fetch(request);
