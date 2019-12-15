export default (input: string): Promise<string[]> =>
  fetch(
    'https://api.cloudconvert.com/v2/convert/formats?filter[input_format]=' +
      input
  )
    .then(res => res.json())
    .then(val =>
      val.data.map((v: { output_format: string }) => v.output_format)
    );
