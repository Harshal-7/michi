# Content

`schema.ts` is the contract between the content pipeline (`scripts/content/`) and the app's seed
runner. `generated/*.json` holds one array per file, built by the pipeline and committed.

The files here now are one-record samples so both sides can be built at the same time. The content
pipeline replaces them with the real data.
