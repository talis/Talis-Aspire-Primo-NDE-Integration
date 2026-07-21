/**
 * Talis Aspire Configuration Interface
 *
 * These values should be provided via MODULE_PARAMETERS injection token
 * by the institution's add-on configuration JSON in Alma.
 */
export interface TalisAspireConfig {
  httpBaseUrl: string;
  baseUrl: string;
  mmsIdInstitutionCode: number;
  relatedListsDisplayLabel?: string;
  displayBookmarkThisButton?: boolean;
  bookmarkThisTitleAttribute?: string;
  bookmarkThisButtonText?: string;
}

/**
 * Default configuration values
 * Used when values are not provided in MODULE_PARAMETERS
 */
export const TALIS_ASPIRE_DEFAULTS = {
  relatedListsDisplayLabel: 'Cited on reading lists:',
  displayBookmarkThisButton: true,
  bookmarkThisTitleAttribute: 'bookmark this item to reading lists',
  bookmarkThisButtonText: 'Send To Reading Lists',
};

/**
 * Coerce a value that may arrive as a boolean or a string (Alma sends all
 * MODULE_PARAMETERS values as strings) into a boolean.
 */
function coerceBoolean(value: any): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }
  return undefined;
}

/**
 * Get configuration with defaults applied
 *
 * Accepts either:
 *  - Alma production shape: parameters are provided flat directly on
 *    MODULE_PARAMETERS (and values arrive as strings), or
 *  - Local dev shape: parameters are nested under a `talisAspire` key.
 */
export function getTalisAspireConfig(moduleParameters: any): TalisAspireConfig {
  // Prefer nested `talisAspire` (local dev config) but fall back to the flat
  // parameters object that Alma provides in production.
  const config = moduleParameters?.talisAspire ?? moduleParameters;

  if (!config || (!config.baseUrl && !config.mmsIdInstitutionCode)) {
    console.error(
      'Talis Aspire configuration not found in MODULE_PARAMETERS. Please configure the add-on in Alma.',
    );
    throw new Error('Talis Aspire configuration missing');
  }

  // Validate required fields
  if (!config.baseUrl) {
    throw new Error('Talis Aspire baseUrl is required in configuration');
  }
  if (!config.mmsIdInstitutionCode) {
    throw new Error(
      'Talis Aspire mmsIdInstitutionCode is required in configuration',
    );
  }

  const displayBookmarkThisButton = coerceBoolean(
    config.displayBookmarkThisButton,
  );

  // Apply defaults for optional fields
  return {
    httpBaseUrl:
      config.httpBaseUrl || config.baseUrl.replace('https://', 'http://'), // Convert HTTPS to HTTP if not provided
    baseUrl: config.baseUrl,
    mmsIdInstitutionCode: Number(config.mmsIdInstitutionCode),
    relatedListsDisplayLabel:
      config.relatedListsDisplayLabel ??
      TALIS_ASPIRE_DEFAULTS.relatedListsDisplayLabel,
    displayBookmarkThisButton:
      displayBookmarkThisButton ??
      TALIS_ASPIRE_DEFAULTS.displayBookmarkThisButton,
    bookmarkThisTitleAttribute:
      config.bookmarkThisTitleAttribute ??
      TALIS_ASPIRE_DEFAULTS.bookmarkThisTitleAttribute,
    bookmarkThisButtonText:
      config.bookmarkThisButtonText ??
      TALIS_ASPIRE_DEFAULTS.bookmarkThisButtonText,
  };
}

/**
 * Helper function to check if an MMS ID matches the institution code
 */
export function checkMMSIDcontainsInstitutionCode(
  mmsId: string,
  institutionCode: number,
): string | undefined {
  const mmsidCheck = new RegExp('^99[0-9]*' + institutionCode + '$');
  if (mmsidCheck.test(mmsId)) {
    return mmsId;
  }
  return undefined;
}

/**
 * Extract MMS IDs from an item's PNX data
 */
export function extractMmsIds(item: any, institutionCode: number): string[] {
  const mmsIdArr: string[] = [];

  // Check if the nested properties exist before accessing
  if (item?.pnx?.display?.mms) {
    item.pnx.display.mms.forEach((mmsID: string) => {
      const result = checkMMSIDcontainsInstitutionCode(mmsID, institutionCode);
      if (result) {
        mmsIdArr.push(result);
      }
    });
  }

  return mmsIdArr;
}

/**
 * Extract ISBNs from an item's PNX data
 */
export function extractIsbns(item: any): string[] {
  const isbnArr: string[] = [];

  // Check for ISBNs in addata section
  if (item?.pnx?.addata?.isbn && Array.isArray(item.pnx.addata.isbn)) {
    item.pnx.addata.isbn.forEach((isbn: string) => {
      // Clean ISBN: remove hyphens and spaces
      const cleanIsbn = isbn.replace(/[-\s]/g, '');
      if (cleanIsbn && cleanIsbn.length >= 10) {
        isbnArr.push(cleanIsbn);
      }
    });
  }

  return isbnArr;
}

/**
 * Build OpenURL query parameters from addata section
 * Used when no MMS ID is available
 */
export function buildOpenUrlParams(addata: any): string {
  if (!addata) {
    return '';
  }

  const params: Record<string, string> = {};

  // Helper to add first value from array
  const addParam = (key: string, addataKey: string) => {
    if (
      addata[addataKey] &&
      Array.isArray(addata[addataKey]) &&
      addata[addataKey][0]
    ) {
      params[key] = addata[addataKey][0];
    }
  };

  // Map addata fields to OpenURL parameters
  addParam('rft.atitle', 'atitle'); // article title
  addParam('rft.jtitle', 'jtitle'); // journal title
  addParam('rft.au', 'au'); // author
  addParam('rft.date', 'date'); // date
  addParam('rft.volume', 'volume'); // volume
  addParam('rft.issue', 'issue'); // issue
  addParam('rft.spage', 'spage'); // start page
  addParam('rft.epage', 'epage'); // end page
  addParam('rft.pages', 'pages'); // pages
  addParam('rft.issn', 'issn'); // ISSN
  addParam('rft.eissn', 'eissn'); // eISSN
  addParam('rft.isbn', 'isbn'); // ISBN
  addParam('rft.doi', 'doi'); // DOI
  addParam('rft.genre', 'genre'); // genre (article, book, etc.)
  addParam('rft.pub', 'pub'); // publisher
  addParam('rft.btitle', 'btitle'); // book title

  // Build query string
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join('&');
}
