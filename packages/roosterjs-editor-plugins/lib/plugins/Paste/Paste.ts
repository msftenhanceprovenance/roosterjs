import convertPastedContentForLI from './commonConverter/convertPastedContentForLI';
import convertPastedContentFromExcel from './excelConverter/convertPastedContentFromExcel';
import convertPastedContentFromPowerPoint from './pptConverter/convertPastedContentFromPowerPoint';
import convertPastedContentFromWord from './wordConverter/convertPastedContentFromWord';
import handleLineMerge from './lineMerge/handleLineMerge';
import { EditorPlugin, IEditor, PluginEvent, PluginEventType } from 'roosterjs-editor-types';
import { toArray } from 'roosterjs-editor-dom';
import { WAC_IDENTIFY_SELECTOR } from './officeOnlineConverter/constants';
import convertPastedContentFromWordOnline, {
    isWordOnlineWithList,
} from './officeOnlineConverter/convertPastedContentFromWordOnline';

const WORD_ATTRIBUTE_NAME = 'xmlns:w';
const WORD_ATTRIBUTE_VALUE = 'urn:schemas-microsoft-com:office:word';
const EXCEL_ATTRIBUTE_NAME = 'xmlns:x';
const EXCEL_ATTRIBUTE_VALUE = 'urn:schemas-microsoft-com:office:excel';
const PROG_ID_NAME = 'ProgId';
const EXCEL_ONLINE_ATTRIBUTE_VALUE = 'Excel.Sheet';
const POWERPOINT_ATTRIBUTE_VALUE = 'PowerPoint.Slide';
const GOOGLE_SHEET_NODE_NAME = 'google-sheets-html-origin';

/**
 * Paste plugin, handles BeforePaste event and reformat some special content, including:
 * 1. Content copied from Word
 * 2. Content copied from Excel
 * 3. Content copied from Word Online or OneNote Online
 */
export default class Paste implements EditorPlugin {
    private editor: IEditor;

    /**
     * Construct a new instance of Paste class
     * @param unknownTagReplacement Replace solution of unknown tags, default behavior is to replace with SPAN
     */
    constructor(private unknownTagReplacement: string = 'SPAN') {}

    /**
     * Get a friendly name of  this plugin
     */
    getName() {
        return 'Paste';
    }

    /**
     * Initialize this plugin. This should only be called from Editor
     * @param editor Editor instance
     */
    initialize(editor: IEditor) {
        this.editor = editor;
    }

    /**
     * Dispose this plugin
     */
    dispose() {
        this.editor = null;
    }

    /**
     * Handle events triggered from editor
     * @param event PluginEvent object
     */
    onPluginEvent(event: PluginEvent) {
        if (event.eventType == PluginEventType.BeforePaste) {
            const { htmlAttributes, fragment, sanitizingOption } = event;
            const trustedHTMLHandler = this.editor.getTrustedHTMLHandler();
            let wacListElements: Node[];

            if (htmlAttributes[WORD_ATTRIBUTE_NAME] == WORD_ATTRIBUTE_VALUE) {
                // Handle HTML copied from Word
                convertPastedContentFromWord(event);
            } else if (
                htmlAttributes[EXCEL_ATTRIBUTE_NAME] == EXCEL_ATTRIBUTE_VALUE ||
                htmlAttributes[PROG_ID_NAME] == EXCEL_ONLINE_ATTRIBUTE_VALUE
            ) {
                // Handle HTML copied from Excel
                convertPastedContentFromExcel(event, trustedHTMLHandler);
            } else if (htmlAttributes[PROG_ID_NAME] == POWERPOINT_ATTRIBUTE_VALUE) {
                convertPastedContentFromPowerPoint(event, trustedHTMLHandler);
            } else if (
                (wacListElements = toArray(fragment.querySelectorAll(WAC_IDENTIFY_SELECTOR))) &&
                wacListElements.length > 0
            ) {
                // Once it is known that the document is from WAC
                // We need to remove the display property and margin from all the list item
                wacListElements.forEach((el: HTMLElement) => {
                    el.style.display = null;
                    el.style.margin = null;
                });
                // call conversion function if the pasted content is from word online and
                // has list element in the pasted content.
                if (isWordOnlineWithList(fragment)) {
                    convertPastedContentFromWordOnline(fragment);
                }
            } else if (fragment.querySelector(GOOGLE_SHEET_NODE_NAME)) {
                sanitizingOption.additionalTagReplacements[GOOGLE_SHEET_NODE_NAME] = '*';
            } else {
                convertPastedContentForLI(fragment);
                handleLineMerge(fragment);
            }

            // Replace unknown tags with SPAN
            sanitizingOption.unknownTagReplacement = this.unknownTagReplacement;
        }
    }
}
