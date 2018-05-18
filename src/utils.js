/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

/**
 * @module list/utils
 */

import BalloonPanelView from '@ckeditor/ckeditor5-ui/src/panel/balloon/balloonpanelview';

/**
 * Creates list item {@link module:engine/view/containerelement~ContainerElement}.
 *
 * @param {module:engine/view/writer~Writer} writer The writer instance.
 * @returns {module:engine/view/containerelement~ContainerElement}
 */
export function createViewListItemElement( writer ) {
	const viewItem = writer.createContainerElement( 'li' );
	viewItem.getFillerOffset = getFillerOffset;

	return viewItem;
}

// Implementation of getFillerOffset for view list item element.
//
// @returns {Number|null} Block filler offset or `null` if block filler is not needed.
function getFillerOffset() {
	const hasOnlyLists = !this.isEmpty && ( this.getChild( 0 ).name == 'ul' || this.getChild( 0 ).name == 'ol' );

	return this.isEmpty || hasOnlyLists ? 0 : null;
}

/**
 * Returns list style type options based on particular list type.
 *
 * @param {String} listType List style type, numberedListStyle or bulletedListStyle.
 * @returns {Object} List of available options.
 */
export function listStyleOptions( listType ) {
  const numberedStyleOptions = {
    'lower-roman': 'Lower Roman (i, ii, iii, iv, v, etc.)',
    'upper-roman': 'Upper Roman (I, II, III, IV, V, etc.)',
    'lower-alpha': 'Lower Alpha (a, b, c, d, e, etc.)',
    'upper-alpha': 'Upper Alpha (A, B, C, D, E, etc.)',
    'decimal': 'Decimal (1, 2, 3, etc.)'
  };

  const bulletedStyleOptions = {
    'circle': 'Circle',
    'disc': 'Disc',
    'square': 'Square'
  };

  return ( listType === 'numberedListStyle' ) ? numberedStyleOptions : bulletedStyleOptions;
}

/**
 * Returns parent list item.
 *
 * @param {module:engine/model/position} position
 * @returns {*}
 */
export function getParentListItem( position ) {
  let parent = position.parent;

  while ( parent ) {
    if ( parent.name === 'li' ) {
      return parent;
    }
    parent = parent.parent;
  }
}

/**
 * Checks if an list widget is the only selected element.
 *
 * @param {module:engine/view/selection~Selection|module:engine/view/documentselection~DocumentSelection} selection
 * @returns {Boolean}
 */
export function isListWidgetSelected( selection ) {
  const viewElement = getParentListItem(selection.getFirstPosition());

  return !!( viewElement );
}

/**
 * A helper utility that positions the
 * {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon contextual balloon} instance
 * with respect to the image in the editor content, if one is selected.
 *
 * @param {module:core/editor/editor~Editor} editor The editor instance.
 */
export function repositionContextualBalloon( editor ) {
  const balloon = editor.plugins.get( 'ContextualBalloon' );

  if ( isListWidgetSelected( editor.editing.view.document.selection ) ) {
    const position = getBalloonPositionData( editor );

    balloon.updatePosition( position );
  }
}

/**
 * Returns the positioning options that control the geometry of the
 * {@link module:ui/panel/balloon/contextualballoon~ContextualBalloon contextual balloon} with respect
 * to the selected element in the editor content.
 *
 * @param {module:core/editor/editor~Editor} editor The editor instance.
 * @returns {module:utils/dom/position~Options}
 */
export function getBalloonPositionData( editor ) {
  const editingView = editor.editing.view;
  const defaultPositions = BalloonPanelView.defaultPositions;

  const viewElement = getParentListItem( editingView.document.selection.getFirstPosition() );

  return {
    target: editingView.domConverter.viewToDom( viewElement ),
    positions: [
      defaultPositions.northWestArrowSouth,
      defaultPositions.northWestArrowSouthWest,
      defaultPositions.northWestArrowSouthEast,
      defaultPositions.southWestArrowNorth,
      defaultPositions.southWestArrowNorthWest,
      defaultPositions.southWestArrowNorthEast
    ]
  };
}
