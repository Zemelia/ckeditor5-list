/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module list/liststylecommand
 */

import Command from '@ckeditor/ckeditor5-core/src/command';
import first from '@ckeditor/ckeditor5-utils/src/first';

/**
 * The list command. It is used by the {@link module:list/list~List list feature}.
 *
 * @extends module:core/command~Command
 */
export default class ListStyleCommand extends Command {
	/**
	 * Creates an instance of the command.
	 *
	 * @param {module:core/editor/editor~Editor} editor The editor instance.
	 * @param {'numbered'|'bulleted'} type List type that will be handled by this command.
	 */
	constructor( editor, type ) {
		super( editor );

		/**
		 * The type of the list created by the command.
		 *
		 * @readonly
		 * @member {'numbered'|'bulleted'}
		 */
		this.type = type === 'bulleted' ? 'bulleted' : 'numbered';

		/**
		 * A flag indicating whether the command is active, which means that the selection starts in a list of the same type.
		 *
		 * @observable
		 * @readonly
		 * @member {Boolean} #value
		 */
	}

	/**
	 * @inheritDoc
	 */
	refresh() {
		this.value = this._getValue();
		this.isEnabled = this._checkEnabled();
	}

	/**
	 * Executes the command.
	 *
	 * @protected
	 */
	execute( options = {} ) {
    const model = this.editor.model;
    const document = model.document;
    const selection = document.selection;
    const value = options.value;
    const listItem = first( selection.getSelectedBlocks() );

    model.change( writer => {
      writer.setAttribute( 'listStyle', value, listItem );
    } );
	}

	/**
	 * Checks the command's {@link #value}.
	 *
	 * @private
	 * @returns {Boolean} The current value.
	 */
	_getValue() {
		// Check whether closest `listItem` ancestor of the position has a correct type.
		const listItem = first( this.editor.model.document.selection.getSelectedBlocks() );

		return !!listItem && listItem.is( 'listItem' ) && listItem.getAttribute( 'type' ) == this.type;
	}

	/**
	 * Checks whether the command can be enabled in the current context.
	 *
	 * @private
	 * @returns {Boolean} Whether the command should be enabled.
	 */
	_checkEnabled() {
    // Check whether any of position's ancestor is a list item.
    const listItem = first( this.editor.model.document.selection.getSelectedBlocks() );

    // If selection is not in a list item, the command is disabled.
    if ( !listItem || !listItem.is( 'listItem' ) || (listItem.is( 'listItem' ) && this.type !== listItem.getAttribute('type'))) {
      return false;
    }

    return true;
	}
}
