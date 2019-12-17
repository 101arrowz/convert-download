import React, { useState, Suspense, lazy, useEffect, useRef } from "react";
import { browser } from 'webextension-polyfill-ts';

const InputOutputFormats = lazy<React.FC<{}>>(async () => {
  const data = await (await fetch('https://api.cloudconvert.com/v2/convert/formats')).json();
  const formats = data.data;
  const inputFormatsSet: Set<string> = new Set();
  const outputMapper: { [k: string]: string[] } = {};
  for (const format of formats) {
    inputFormatsSet.add(format.input_format);
    const outs = outputMapper[format.input_format];
    if (!outs)
      outputMapper[format.input_format] = [format.output_format];
    else outs.push(format.output_format);
  }
  let { recommendedOption: defaultExt } = await browser.storage.local.get(['recommendedOption']) as { recommendedOption: string };
  if (defaultExt) browser.storage.local.remove(['recommendedOption']);
  if (!inputFormatsSet.has(defaultExt)) defaultExt = '';
  const inputFormats = [...inputFormatsSet];
  return {
    default: () => {
      const [ext, setExt] = useState(defaultExt);
      const outputFormats = outputMapper[ext];
      const [disabled, setDisabled] = useState(false);
      const [removeOrig, setRemoveOrig] = useState(false);
      const outputFormatRef = useRef();
      return (
        <>
          <span>Input Format</span><select onChange={newVal => {
            setExt(newVal.target.value);
          }} value={ext}>
            {inputFormats.map(el => <option key={el} value={el}>{el}</option>)}
          </select>
          {outputFormats ? <><span>Output Format</span><select ref={outputFormatRef}>
            {outputFormats.map(el => <option key={el} value={el}>{el}</option>)}
          </select>
          <span>Remove Original</span><input type="checkbox" checked={removeOrig} onClick={() => setRemoveOrig(!removeOrig)}></input>
          <span>Disabled</span><input type="checkbox" checked={disabled} onClick={() => setDisabled(!disabled)}></input>
          <button onClick={() => {
            browser.storage.local.set({
              [ext]: {
                disabled,
                convertTo: (outputFormatRef.current as HTMLInputElement).value,
                removeOrig
              }
            });
            setExt('');
            setDisabled(false);
            setRemoveOrig(false);
          }}>Make change</button></> : <span>Please select a valid extension.</span>}
        </>
      );
    }
  };
});

const Options: React.FC = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <Suspense fallback={<div>Loading...</div>}>
        <InputOutputFormats />
      </Suspense>
    </div>);
}
export default Options;