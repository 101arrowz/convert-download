import React, { useState, useEffect, Suspense, lazy } from "react";

const InputOutputFormats = lazy<React.FC<{
  onChangeExt: (v: string) => void,
  onChangeOutFormat: (v: string) => void
}>>(() => fetch('https://api.cloudconvert.com/v2/convert/formats').then(res => res.json()).then(data => {
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
  const inputFormats = [...inputFormatsSet];
  return new Promise(resolve => chrome.storage.local.get(['recommendedOption'], ({ recommendedOption: defaultExt }: { recommendedOption: string }) => {
    if (!chrome.runtime.lastError && defaultExt) chrome.storage.local.remove(['recommendedOption']);
    if (!inputFormats.includes(defaultExt)) defaultExt = '';
    resolve({
      default: (({ onChangeExt, onChangeOutFormat }) => {
        const [intExt, intSetExt] = useState(defaultExt);
        const outputFormats = outputMapper[intExt];
        return (
          <>
            <span>Input Format</span><select onChange={newVal => {
              intSetExt(newVal.target.value);
              onChangeExt(newVal.target.value);
            }} value={intExt}>
              {inputFormats.map(el => <option key={el} value={el}>{el}</option>)}
            </select>
            {outputFormats ? <><span>Output Format</span><select onChange={newVal => {
              onChangeOutFormat(newVal.target.value);
            }}>
              {outputFormats.map(el => <option key={el} value={el}>{el}</option>)}
            </select></> : null}
          </>
        )
      })
    });
  }));
}));

const Options: React.FC = () => {
  const [ext, setExt] = useState('');
  const [convertTo, setConvertTo] = useState('');
  const [disabled, setDisabled] = useState(false);
  const [removeOrig, setRemoveOrig] = useState(false);
  useEffect(() => {
    chrome.storage.local.get(['recommendedOption'], ({ recommendedOption }: { recommendedOption: string }) => {
      if (recommendedOption) {
        if (!ext) setExt(recommendedOption);
        delete win.recommendedOption;
      }
    })
  }, []);
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <Suspense fallback={<div>Loading...</div>}>
        <InputOutputFormats onChangeExt={setExt} onChangeOutFormat={setConvertTo} />
      </Suspense>
      <span>Remove Original</span><input type="checkbox" checked={removeOrig} onClick={() => setRemoveOrig(!removeOrig)}></input>
      <span>Disabled</span><input  type="checkbox" checked={disabled} onClick={() => setDisabled(!disabled)}></input>
      <button onClick={() => {
        chrome.storage.local.set({
          [ext]: {
            disabled,
            convertTo,
            removeOrig
          }
        });
        setExt('');
        setConvertTo('');
        setDisabled(false);
        setRemoveOrig(false);
      }}>Make change</button>
    </div>);
}
export default Options;