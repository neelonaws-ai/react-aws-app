// reactIframeHost.js
// LWC component that embeds the React app hosted on CloudFront as an iframe
import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

// Your CloudFront domain — update after running setup-aws.sh
const REACT_APP_ORIGIN = 'https://d1abc123example.cloudfront.net';

export default class ReactIframeHost extends NavigationMixin(LightningElement) {
  @api recordId;
  @api objectApiName;
  @api iframeHeight = '640';
  @api iframeTitle  = 'React Application';

  _messageHandler = null;
  _reactReady     = false;

  // ── Lifecycle ──────────────────────────────────────────────────
  connectedCallback() {
    this._messageHandler = this._handleMessage.bind(this);
    window.addEventListener('message', this._messageHandler);
  }

  disconnectedCallback() {
    window.removeEventListener('message', this._messageHandler);
  }

  // ── Template helpers ───────────────────────────────────────────
  get iframeSrc()   { return REACT_APP_ORIGIN; }
  get iframeStyle() { return `width:100%; height:${this.iframeHeight}px; border:none; border-radius:8px;`; }

  // ── iframe onload ──────────────────────────────────────────────
  handleLoad() {
    // React app fires REACT_LOADED via postMessage when it mounts.
    // We respond to that, not this onload, so nothing needed here.
  }

  // ── Incoming messages from React ───────────────────────────────
  _handleMessage(event) {
    // Security: only accept from our CloudFront origin
    if (event.origin !== REACT_APP_ORIGIN) return;

    const { type, payload } = event.data || {};

    switch (type) {
      case 'REACT_LOADED':
        // React app is mounted — send Salesforce context
        this._sendToReact('SF_INIT', {
          recordId:      this.recordId,
          objectApiName: this.objectApiName,
          baseUrl:       window.location.origin
        });
        break;

      case 'REACT_READY':
        this._reactReady = true;
        break;

      case 'SHOW_TOAST':
        this.dispatchEvent(new ShowToastEvent({
          title:   payload?.title   || 'Notification',
          message: payload?.message || '',
          variant: payload?.variant || 'info'
        }));
        break;

      case 'NAVIGATE':
        if (payload?.recordId) {
          this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: { recordId: payload.recordId, actionName: 'view' }
          });
        }
        break;

      case 'RESIZE':
        if (payload?.height) {
          const iframe = this.template.querySelector('iframe');
          if (iframe) iframe.style.height = `${payload.height}px`;
        }
        break;

      default:
        break;
    }
  }

  // ── Send message to React ──────────────────────────────────────
  _sendToReact(type, payload) {
    const iframe = this.template.querySelector('iframe');
    iframe?.contentWindow?.postMessage({ type, payload }, REACT_APP_ORIGIN);
  }
}
