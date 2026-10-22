export type GraphClientOpts = {
  baseUrl: string;
  version: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export function createGraphClient(opts: GraphClientOpts) {
  const fetchFn = opts.fetchImpl ?? fetch;
  const headers = {
    Authorization: `Bearer ${opts.token}`,
    "Content-Type": "application/json",
  };

  return {
    async getPhoneNumber(phoneNumberId: string) {
      const res = await fetchFn(`${opts.baseUrl}/${opts.version}/${phoneNumberId}`, { headers });
      return res.json();
    },
    async listPhoneNumbers(wabaId: string) {
      const res = await fetchFn(`${opts.baseUrl}/${opts.version}/${wabaId}/phone_numbers?limit=100`, {
        headers,
      });
      return res.json() as Promise<{ data: Array<Record<string, unknown>> }>;
    },
    async listTemplates(wabaId: string) {
      const res = await fetchFn(
        `${opts.baseUrl}/${opts.version}/${wabaId}/message_templates?limit=100`,
        { headers },
      );
      return res.json() as Promise<{ data: Array<Record<string, unknown>>; paging?: { next?: string } }>;
    },
    async getMedia(mediaId: string, phoneNumberId: string) {
      const res = await fetchFn(
        `${opts.baseUrl}/${opts.version}/${mediaId}?phone_number_id=${phoneNumberId}`,
        { headers },
      );
      return res.json() as Promise<{ url: string; mime_type: string; sha256: string; file_size: number }>;
    },
    async downloadUrl(url: string) {
      const res = await fetchFn(url, { headers: { Authorization: `Bearer ${opts.token}` } });
      if (!res.ok) throw new Error(`Media download failed: ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
  };
}
