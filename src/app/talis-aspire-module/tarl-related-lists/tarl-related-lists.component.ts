import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  Inject,
  Optional,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import {
  getTalisAspireConfig,
  TalisAspireConfig,
  extractMmsIds,
  extractIsbns,
} from '../talis-aspire.config';

@Component({
  selector: 'tarl-related-lists',
  standalone: true,
  imports: [CommonModule, MatDividerModule, MatIconModule, MatButtonModule],
  templateUrl: './tarl-related-lists.component.html',
  styleUrl: './tarl-related-lists.component.scss',
})
export class TarlRelatedListsComponent implements OnInit, OnChanges {
  @Input() private hostComponent!: any; // Provided by Primo NDE

  listsFound: { [url: string]: string } | null = null;
  displayLabel = '';
  private config!: TalisAspireConfig;

  constructor(
    private http: HttpClient,
    @Optional() @Inject('MODULE_PARAMETERS') private moduleParameters: any,
  ) {}

  ngOnInit(): void {
    // Load configuration from MODULE_PARAMETERS
    try {
      this.config = getTalisAspireConfig(this.moduleParameters);
      this.displayLabel = this.config.relatedListsDisplayLabel!;
    } catch (error) {
      console.error('Failed to load Talis Aspire configuration:', error);
      return;
    }

    // Initial load for the record present when the component is created.
    this.loadListsForCurrentRecord();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Primo reuses this component instance and pushes a new record when the
    // user navigates between records in full display (e.g. the record-selector
    // buttons). Re-fetch whenever a new host record is bound. The first change
    // is handled by ngOnInit once config is ready, so it is skipped here.
    const hostChange = changes['hostComponent'];
    if (hostChange && !hostChange.isFirstChange() && this.config) {
      this.loadListsForCurrentRecord();
    }
  }

  private loadListsForCurrentRecord(): void {
    // Clear any lists carried over from the previously displayed record.
    this.listsFound = null;

    // Get search result from host component
    const item = this.hostComponent?.searchResult;
    if (!item) {
      console.warn('No searchResult found from hostComponent');
      return;
    }

    // Extract MMS IDs for this item
    const mmsIds = extractMmsIds(item, this.config.mmsIdInstitutionCode);

    if (mmsIds.length > 0) {
      // Fetch lists for each MMS ID
      mmsIds.forEach((mmsId) => {
        this.fetchListsForMmsId(mmsId);
      });
    } else {
      // No MMS ID found, try ISBN as fallback
      const isbns = extractIsbns(item);
      isbns.forEach((isbn) => {
        this.fetchListsForISBN(isbn);
      });
    }
  }

  private fetchListsForMmsId(mmsId: string): void {
    const url = `${this.config.baseUrl}lcn/${mmsId}/lists.json`;
    this.fetchLists(url, `MMS ID: ${mmsId}`);
  }

  private fetchListsForISBN(isbn: string): void {
    const url = `${this.config.baseUrl}isbn/${isbn}/lists.json`;
    this.fetchLists(url, `ISBN: ${isbn}`);
  }

  private fetchLists(url: string, identifier: string): void {
    // Make the call to Talis Aspire API using JSONP (to bypass CORS)
    this.http.jsonp<{ [url: string]: string }>(url, 'cb').subscribe({
      next: (data: any) => {
        // Update URLs from HTTP to HTTPS
        const updatedData: { [url: string]: string } = {};

        if (data && typeof data === 'object') {
          Object.keys(data).forEach((oldKey) => {
            const newKey = oldKey.replace(
              this.config.httpBaseUrl,
              this.config.baseUrl,
            );
            updatedData[newKey] = data[oldKey];
          });

          // Merge with existing lists (in case multiple identifiers return results)
          this.listsFound = { ...this.listsFound, ...updatedData };
        }
      },
      error: (error) => {
        // Silently fail - don't show lists if API call fails
        console.error(
          `Talis Aspire API request failed for ${identifier}:`,
          error,
        );
      },
    });
  }

  get listEntries(): Array<{ url: string; name: string }> {
    if (!this.listsFound) {
      return [];
    }
    return Object.entries(this.listsFound).map(([url, name]) => ({
      url,
      name,
    }));
  }
}
