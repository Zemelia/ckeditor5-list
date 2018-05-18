/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module list/listui
 */

import numberedListIcon from '../theme/icons/numberedlist.svg';
import bulletedListIcon from '../theme/icons/bulletedlist.svg';

import Plugin from '@ckeditor/ckeditor5-core/src/plugin';
import ButtonView from '@ckeditor/ckeditor5-ui/src/button/buttonview';
import { createDropdown, addListToDropdown } from '@ckeditor/ckeditor5-ui/src/dropdown/utils';
import Collection from '@ckeditor/ckeditor5-utils/src/collection';
import { listStyleOptions } from './utils';
import Model from '@ckeditor/ckeditor5-ui/src/model';

/**
 * The list UI feature. It introduces the `numberedList` and `bulletedList` buttons that
 * allow to convert paragraphs to and from list items and indent or outdent them.
 *
 * @extends module:core/plugin~Plugin
 */
export default class ListUI extends Plugin {
	/**
	 * @inheritDoc
	 */
	init() {
		// Create two buttons and link them with numberedList and bulletedList commands.
		const t = this.editor.t;
		this._addButton( 'numberedList', t( 'Numbered List' ), numberedListIcon );
		this._addButton( 'bulletedList', t( 'Bulleted List' ), bulletedListIcon );

		// Create dropdowns with styles for numbered and bulleted lists.
    this._addDropdown( 'numberedListStyle', t( 'Numbered List Style' ) );
    this._addDropdown( 'bulletedListStyle', t( 'Bulleted List Style' ) );
	}

	/**
	 * Helper method for initializing a button and linking it with an appropriate command.
	 *
	 *
	 * @private
	 * @param {String} commandName The name of the command.
	 * @param {Object} label The button label.
	 * @param {String} icon The source of the icon.
	 */
	_addButton( commandName, label, icon ) {
		const editor = this.editor;

		editor.ui.componentFactory.add( commandName, locale => {
			const command = editor.commands.get( commandName );

			const buttonView = new ButtonView( locale );

			buttonView.set( {
				label,
				icon,
				tooltip: true
			} );

			// Bind button model to command.
			buttonView.bind( 'isOn', 'isEnabled' ).to( command, 'value', 'isEnabled' );

			// Execute command.
			this.listenTo( buttonView, 'execute', () => editor.execute( commandName ) );

			return buttonView;
		} );
	}

  /**
   * Helper method for initializing a dropdown and linking those options with an appropriate command.
   *
   *
   * @private
   * @param {String} commandName The name of the command.
   * @param {Object} label The dropdown label.
   */
  _addDropdown( commandName, label ) {
    const editor = this.editor;

    // Register UI component.
    editor.ui.componentFactory.add( commandName, locale => {
      const command = editor.commands.get( commandName );

      const dropdownView = createDropdown( locale );
      addListToDropdown( dropdownView, _prepareListOptions( command, commandName ) );

      // Create dropdown model.
      dropdownView.buttonView.set( {
        label: label,
        withText: true,
        tooltip: true
      } );

      dropdownView.bind( 'isEnabled' ).to( command );

      // Execute command when an item from the dropdown is selected.
      this.listenTo( dropdownView, 'execute', evt => {
        editor.execute( evt.source.commandName, { value: evt.source.commandParam } );
        editor.editing.view.focus();
      } );

      return dropdownView;
    } );
  }

}

/**
 * Prepare dropdown list options.
 *
 * @param {} command
 * @param {String} commandName
 * @returns {Collection}
 * @private
 */
function _prepareListOptions( command, commandName ) {
  const dropdownItems = new Collection();
  const options = Object.assign( {'not-set': 'Not set'}, listStyleOptions( commandName ) );

  for ( const option in options ) {
    const itemModel = new Model( {
      commandName: commandName,
      commandParam: option,
      label: options[option],
      class: 'ck-list-style-option'
    } );

    itemModel.bind( 'isActive' ).to( command, 'value', value => value === option );

    // Add the option to the collection.
    dropdownItems.add( itemModel );
  }

  return dropdownItems;
}
