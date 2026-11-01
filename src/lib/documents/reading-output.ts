/** Keep bulky raw provider JSON in the persisted run, outside the reader's client payload. */
export function readingOutput(output:Record<string,unknown>):Record<string,unknown> {
  return Object.fromEntries(Object.entries(output).filter(([key])=>key!=="extraction").map(([key,value])=>{
    const page=value&&typeof value==="object"?value as Record<string,unknown>:{};
    return [key,{uncertainty:page.uncertainty,language:page.language,receipt:page.receipt}];
  }));
}
