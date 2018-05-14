/**
 * @license Copyright (c) 2003-2018, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.md.
 */

import ListEditing from '../src/listediting';
import ListCommand from '../src/listcommand';

import ModelDocumentFragment from '@ckeditor/ckeditor5-engine/src/model/documentfragment';
import ModelPosition from '@ckeditor/ckeditor5-engine/src/model/position';
import ModelRange from '@ckeditor/ckeditor5-engine/src/model/range';
import ModelElement from '@ckeditor/ckeditor5-engine/src/model/element';
import ModelText from '@ckeditor/ckeditor5-engine/src/model/text';
import ViewPosition from '@ckeditor/ckeditor5-engine/src/view/position';
import ViewUIElement from '@ckeditor/ckeditor5-engine/src/view/uielement';

import BoldEditing from '@ckeditor/ckeditor5-basic-styles/src/bold/boldediting';
import UndoEditing from '@ckeditor/ckeditor5-undo/src/undoediting';
import Clipboard from '@ckeditor/ckeditor5-clipboard/src/clipboard';
import BlockQuoteEditing from '@ckeditor/ckeditor5-block-quote/src/blockquoteediting';

import VirtualTestEditor from '@ckeditor/ckeditor5-core/tests/_utils/virtualtesteditor';
import { getData as getModelData, setData as setModelData, parse as parseModel } from '@ckeditor/ckeditor5-engine/src/dev-utils/model';
import { getData as getViewData, parse as parseView } from '@ckeditor/ckeditor5-engine/src/dev-utils/view';

import { insertElement } from '@ckeditor/ckeditor5-engine/src/conversion/downcast-converters';
import { upcastElementToElement } from '@ckeditor/ckeditor5-engine/src/conversion/upcast-converters';
import { getCode } from '@ckeditor/ckeditor5-utils/src/keyboard';

describe( 'ListEditing', () => {
	let editor, model, modelDoc, modelRoot, view, viewDoc, viewRoot;

	beforeEach( () => {
		return VirtualTestEditor
			.create( {
				plugins: [ Clipboard, BoldEditing, ListEditing, UndoEditing, BlockQuoteEditing ]
			} )
			.then( newEditor => {
				editor = newEditor;

				model = editor.model;
				modelDoc = model.document;
				modelRoot = modelDoc.getRoot();

				view = editor.editing.view;
				viewDoc = view.document;
				viewRoot = viewDoc.getRoot();

				model.schema.register( 'foo', {
					allowWhere: '$block',
					allowAttributes: [ 'indent', 'type' ],
					isBlock: true,
					isObject: true
				} );
			} );
	} );

	it( 'should be loaded', () => {
		expect( editor.plugins.get( ListEditing ) ).to.be.instanceOf( ListEditing );
	} );

	it( 'should set proper schema rules', () => {
		expect( model.schema.isRegistered( 'listItem' ) );
		expect( model.schema.isBlock( 'listItem' ) );

		expect( model.schema.checkChild( [ '$root' ], 'listItem' ) ).to.be.true;
		expect( model.schema.checkChild( [ '$root', 'listItem' ], '$text' ) ).to.be.true;
		expect( model.schema.checkChild( [ '$root', 'listItem' ], 'listItem' ) ).to.be.false;
		expect( model.schema.checkChild( [ '$root', 'listItem' ], '$block' ) ).to.be.false;

		expect( model.schema.checkAttribute( [ '$root', 'listItem' ], 'indent' ) ).to.be.true;
		expect( model.schema.checkAttribute( [ '$root', 'listItem' ], 'type' ) ).to.be.true;
	} );

	describe( 'commands', () => {
		it( 'should register bulleted list command', () => {
			const command = editor.commands.get( 'bulletedList' );

			expect( command ).to.be.instanceOf( ListCommand );
			expect( command ).to.have.property( 'type', 'bulleted' );
		} );

		it( 'should register numbered list command', () => {
			const command = editor.commands.get( 'numberedList' );

			expect( command ).to.be.instanceOf( ListCommand );
			expect( command ).to.have.property( 'type', 'numbered' );
		} );
	} );

	describe( 'enter key handling callback', () => {
		it( 'should execute outdentList command on enter key in empty list', () => {
			const domEvtDataStub = { preventDefault() {} };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<listItem type="bulleted" indent="0">[]</listItem>' );

			editor.editing.view.document.fire( 'enter', domEvtDataStub );

			sinon.assert.calledOnce( editor.execute );
			sinon.assert.calledWithExactly( editor.execute, 'outdentList' );
		} );

		it( 'should not execute outdentList command on enter key in non-empty list', () => {
			const domEvtDataStub = { preventDefault() {} };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<listItem type="bulleted" indent="0">foo[]</listItem>' );

			editor.editing.view.document.fire( 'enter', domEvtDataStub );

			sinon.assert.notCalled( editor.execute );
		} );
	} );

	describe( 'delete key handling callback', () => {
		it( 'should execute outdentList command on backspace key in first item of list', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<listItem type="bulleted" indent="0">[]foo</listItem>' );

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.calledWithExactly( editor.execute, 'outdentList' );
		} );

		it( 'should execute outdentList command on backspace key in first item of list', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<paragraph>foo</paragraph><listItem type="bulleted" indent="0">[]foo</listItem>' );

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.calledWithExactly( editor.execute, 'outdentList' );
		} );

		it( 'should not execute outdentList command on delete key in first item of list', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'forward' };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<listItem type="bulleted" indent="0">[]foo</listItem>' );

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.notCalled( editor.execute );
		} );

		it( 'should not execute outdentList command when selection is not collapsed', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<listItem type="bulleted" indent="0">[fo]o</listItem>' );

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.notCalled( editor.execute );
		} );

		it( 'should not execute outdentList command if not in list item', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<paragraph>[]foo</paragraph>' );

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.notCalled( editor.execute );
		} );

		it( 'should not execute outdentList command if not in first list item', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData(
				model,
				'<listItem type="bulleted" indent="0">foo</listItem><listItem type="bulleted" indent="0">[]foo</listItem>'
			);

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.notCalled( editor.execute );
		} );

		it( 'should not execute outdentList command when selection is not on first position', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<listItem type="bulleted" indent="0">fo[]o</listItem>' );

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.notCalled( editor.execute );
		} );

		it( 'should not execute outdentList command when selection is not on first position', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData( model, '<listItem type="bulleted" indent="0">fo[]o</listItem>' );

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.notCalled( editor.execute );
		} );

		it( 'should outdent list when previous element is nested in block quote', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData(
				model,
				'<blockQuote><paragraph>x</paragraph></blockQuote><listItem type="bulleted" indent="0">[]foo</listItem>'
			);

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.calledWithExactly( editor.execute, 'outdentList' );
		} );

		it( 'should outdent list when list is nested in block quote', () => {
			const domEvtDataStub = { preventDefault() {}, direction: 'backward' };

			sinon.spy( editor, 'execute' );

			setModelData(
				model,
				'<paragraph>x</paragraph><blockQuote><listItem type="bulleted" indent="0">[]foo</listItem></blockQuote>'
			);

			editor.editing.view.document.fire( 'delete', domEvtDataStub );

			sinon.assert.calledWithExactly( editor.execute, 'outdentList' );
		} );
	} );

	describe( 'tab key handling callback', () => {
		let domEvtDataStub;

		beforeEach( () => {
			domEvtDataStub = {
				keyCode: getCode( 'Tab' ),
				preventDefault: sinon.spy(),
				stopPropagation: sinon.spy()
			};

			sinon.spy( editor, 'execute' );
		} );

		afterEach( () => {
			editor.execute.restore();
		} );

		it( 'should execute indentList command on tab key', () => {
			setModelData(
				model,
				'<listItem type="bulleted" indent="0">foo</listItem>' +
				'<listItem type="bulleted" indent="0">[]bar</listItem>'
			);

			editor.editing.view.document.fire( 'keydown', domEvtDataStub );

			sinon.assert.calledOnce( editor.execute );
			sinon.assert.calledWithExactly( editor.execute, 'indentList' );
			sinon.assert.calledOnce( domEvtDataStub.preventDefault );
			sinon.assert.calledOnce( domEvtDataStub.stopPropagation );
		} );

		it( 'should execute outdentList command on Shift+Tab keystroke', () => {
			domEvtDataStub.keyCode += getCode( 'Shift' );

			setModelData(
				model,
				'<listItem type="bulleted" indent="0">foo</listItem>' +
				'<listItem type="bulleted" indent="1">[]bar</listItem>'
			);

			editor.editing.view.document.fire( 'keydown', domEvtDataStub );

			sinon.assert.calledOnce( editor.execute );
			sinon.assert.calledWithExactly( editor.execute, 'outdentList' );
			sinon.assert.calledOnce( domEvtDataStub.preventDefault );
			sinon.assert.calledOnce( domEvtDataStub.stopPropagation );
		} );

		it( 'should not indent if command is disabled', () => {
			setModelData( model, '<listItem type="bulleted" indent="0">[]foo</listItem>' );

			editor.editing.view.document.fire( 'keydown', domEvtDataStub );

			expect( editor.execute.called ).to.be.false;
			sinon.assert.notCalled( domEvtDataStub.preventDefault );
			sinon.assert.notCalled( domEvtDataStub.stopPropagation );
		} );

		it( 'should not indent or outdent if alt+tab is pressed', () => {
			domEvtDataStub.keyCode += getCode( 'alt' );

			setModelData(
				model,
				'<listItem type="bulleted" indent="0">foo</listItem>' +
				'<listItem type="bulleted" indent="0">[]bar</listItem>'
			);

			editor.editing.view.document.fire( 'keydown', domEvtDataStub );

			expect( editor.execute.called ).to.be.false;
			sinon.assert.notCalled( domEvtDataStub.preventDefault );
			sinon.assert.notCalled( domEvtDataStub.stopPropagation );
		} );
	} );

	describe( 'flat lists', () => {
		describe( 'setting data', () => {
			function test( testName, string, expectedString = null ) {
				it( testName, () => {
					editor.setData( string );
					expect( editor.getData() ).to.equal( expectedString || string );
				} );
			}

			test( 'single item', '<ul><li>x</li></ul>' );
			test( 'multiple items', '<ul><li>a</li><li>b</li><li>c</li></ul>' );
			test( 'items and text', '<p>xxx</p><ul><li>a</li><li>b</li></ul><p>yyy</p><ul><li>c</li><li>d</li></ul>' );
			test( 'numbered list', '<ol><li>a</li><li>b</li></ol>' );
			test( 'mixed list and content #1', '<p>xxx</p><ul><li>a</li><li>b</li></ul><ol><li>c</li><li>d</li></ol><p>yyy</p>' );
			test( 'mixed list and content #2', '<ol><li>a</li></ol><p>xxx</p><ul><li>b</li><li>c</li></ul><p>yyy</p><ul><li>d</li></ul>' );
			test(
				'clears incorrect elements',
				'<ul>x<li>a</li><li>b</li><p>xxx</p>x</ul><p>c</p>', '<ul><li>a</li><li>b</li></ul><p>c</p>'
			);
			test(
				'clears whitespaces',
				'<p>foo</p>' +
				'<ul>' +
				'	<li>xxx</li>' +
				'	<li>yyy</li>' +
				'</ul>',
				'<p>foo</p><ul><li>xxx</li><li>yyy</li></ul>'
			);

			it( 'model test for mixed content', () => {
				editor.setData( '<ol><li>a</li></ol><p>xxx</p><ul><li>b</li><li>c</li></ul><p>yyy</p><ul><li>d</li></ul>' );

				const expectedModelData =
					'<listItem indent="0" type="numbered">a</listItem>' +
					'<paragraph>xxx</paragraph>' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'<listItem indent="0" type="bulleted">c</listItem>' +
					'<paragraph>yyy</paragraph>' +
					'<listItem indent="0" type="bulleted">d</listItem>';

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( expectedModelData );
			} );
		} );

		describe( 'position mapping', () => {
			let mapper;

			beforeEach( () => {
				mapper = editor.editing.mapper;

				editor.setData(
					'<p>a</p>' +
					'<ul>' +
						'<li>b</li>' +
						'<li>c</li>' +
						'<li>d</li>' +
					'</ul>' +
					'<p>e</p>' +
					'<ol>' +
						'<li>f</li>' +
					'</ol>' +
					'<p>g</p>'
				);
			} );

			/*
				<paragraph>a</paragraph>
				<listItem indent=0 type="bulleted">b</listItem>
				<listItem indent=0 type="bulleted">c</listItem>
				<listItem indent=0 type="bulleted">d</listItem>
				<paragraph>e</paragraph>
				<listItem indent=0 type="numbered">f</listItem>
				<paragraph>g</paragraph>
			 */

			describe( 'view to model', () => {
				function test( testName, viewPath, modelPath ) {
					it( testName, () => {
						const viewPos = getViewPosition( viewRoot, viewPath );
						const modelPos = mapper.toModelPosition( viewPos );

						expect( modelPos.root ).to.equal( modelRoot );
						expect( modelPos.path ).to.deep.equal( modelPath );
					} );
				}

				test( 'before ul',			[ 1 ],			[ 1 ] );	// --> before first `listItem`
				test( 'before first li',	[ 1, 0 ],		[ 1 ] );	// --> before first `listItem`
				test( 'beginning of li',	[ 1, 0, 0 ],	[ 1, 0 ] );	// --> beginning of first `listItem`
				test( 'end of li',			[ 1, 0, 1 ],	[ 1, 1 ] );	// --> end of first `listItem`
				test( 'before middle li',	[ 1, 1 ],		[ 2 ] );	// --> before middle `listItem`
				test( 'before last li',		[ 1, 2 ],		[ 3 ] );	// --> before last `listItem`
				test( 'after last li',		[ 1, 3 ],		[ 4 ] );	// --> after last `listItem` / before `paragraph`
				test( 'after ul',			[ 2 ],			[ 4 ] );	// --> after last `listItem` / before `paragraph`
				test( 'before ol',			[ 3 ],			[ 5 ] );	// --> before numbered `listItem`
				test( 'before only li',		[ 3, 0 ],		[ 5 ] );	// --> before numbered `listItem`
				test( 'after only li',		[ 3, 1 ],		[ 6 ] );	// --> after numbered `listItem`
				test( 'after ol',			[ 4 ],			[ 6 ] );	// --> after numbered `listItem`
			} );

			describe( 'model to view', () => {
				function test( testName, modelPath, viewPath ) {
					it( testName, () => {
						const modelPos = new ModelPosition( modelRoot, modelPath );
						const viewPos = mapper.toViewPosition( modelPos );

						expect( viewPos.root ).to.equal( viewRoot );
						expect( getViewPath( viewPos ) ).to.deep.equal( viewPath );
					} );
				}

				test( 'before first listItem',			[ 1 ],		[ 1 ] );			// --> before ul
				test( 'beginning of first listItem',	[ 1, 0 ],	[ 1, 0, 0, 0 ] );	// --> beginning of `b` text node
				test( 'end of first listItem',			[ 1, 1 ],	[ 1, 0, 0, 1 ] );	// --> end of `b` text node
				test( 'before middle listItem',			[ 2 ],		[ 1, 1 ] );			// --> before middle li
				test( 'before last listItem',			[ 3 ],		[ 1, 2 ] );			// --> before last li
				test( 'after last listItem',			[ 4 ],		[ 2 ] );			// --> after ul
				test( 'before numbered listItem',		[ 5 ],		[ 3 ] );			// --> before ol
				test( 'after numbered listItem',		[ 6 ],		[ 4 ] );			// --> after ol
			} );
		} );

		describe( 'convert changes', () => {
			describe( 'insert', () => {
				testInsert(
					'list item at the beginning of same list type',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="bulleted">x</listItem>]' +
					'<listItem indent="0" type="bulleted">a</listItem>',

					'<p>p</p>' +
					'<ul>' +
						'<li>x</li>' +
						'<li>a</li>' +
					'</ul>'
				);

				testInsert(
					'list item in the middle of same list type',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">x</listItem>]' +
					'<listItem indent="0" type="bulleted">b</listItem>',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
						'<li>x</li>' +
						'<li>b</li>' +
					'</ul>'
				);

				testInsert(
					'list item at the end of same list type',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">x</listItem>]',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
						'<li>x</li>' +
					'</ul>'
				);

				testInsert(
					'list item at the beginning of different list type',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="numbered">x</listItem>]' +
					'<listItem indent="0" type="bulleted">a</listItem>',

					'<p>p</p>' +
					'<ol>' +
						'<li>x</li>' +
					'</ol>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>'
				);

				testInsert(
					'list item in the middle of different list type',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="numbered">x</listItem>]' +
					'<listItem indent="0" type="bulleted">b</listItem>',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<ol>' +
						'<li>x</li>' +
					'</ol>' +
					'<ul>' +
						'<li>b</li>' +
					'</ul>'
				);

				testInsert(
					'list item at the end of different list type',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="numbered">x</listItem>]',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<ol>' +
						'<li>x</li>' +
					'</ol>'
				);

				testInsert(
					'element between list items',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<paragraph>x</paragraph>]' +
					'<listItem indent="0" type="bulleted">a</listItem>',

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>x</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>'
				);
			} );

			describe( 'remove', () => {
				testRemove(
					'remove the first list item',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="bulleted">a</listItem>]' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'<listItem indent="0" type="bulleted">c</listItem>',

					'<p>p</p>' +
					'<ul>' +
						'<li>b</li>' +
						'<li>c</li>' +
					'</ul>'
				);

				testRemove(
					'remove list item from the middle',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<listItem indent="0" type="bulleted">c</listItem>',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
						'<li>c</li>' +
					'</ul>'
				);

				testRemove(
					'remove the last list item',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'[<listItem indent="0" type="bulleted">c</listItem>]',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
						'<li>b</li>' +
					'</ul>'
				);

				testRemove(
					'remove the only list item',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="bulleted">x</listItem>]' +
					'<paragraph>p</paragraph>',

					'<p>p</p>' +
					'<p>p</p>'
				);

				testRemove(
					'remove element from between lists of same type',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<paragraph>x</paragraph>]' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'<paragraph>p</paragraph>',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
						'<li>b</li>' +
					'</ul>' +
					'<p>p</p>'
				);

				testRemove(
					'remove element from between lists of different type',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<paragraph>x</paragraph>]' +
					'<listItem indent="0" type="numbered">b</listItem>' +
					'<paragraph>p</paragraph>',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<ol>' +
						'<li>b</li>' +
					'</ol>' +
					'<p>p</p>'
				);
			} );

			describe( 'change type', () => {
				testChangeType(
					'change first list item',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="bulleted">a</listItem>]' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'<listItem indent="0" type="bulleted">c</listItem>',

					'<p>p</p>' +
					'<ol>' +
						'<li>a</li>' +
					'</ol>' +
					'<ul>' +
						'<li>b</li>' +
						'<li>c</li>' +
					'</ul>'
				);

				testChangeType(
					'change middle list item',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<listItem indent="0" type="bulleted">c</listItem>',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<ol>' +
						'<li>b</li>' +
					'</ol>' +
					'<ul>' +
						'<li>c</li>' +
					'</ul>'
				);

				testChangeType(
					'change last list item',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'[<listItem indent="0" type="bulleted">c</listItem>]',

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
						'<li>b</li>' +
					'</ul>' +
					'<ol>' +
						'<li>c</li>' +
					'</ol>'
				);

				testChangeType(
					'change only list item',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="bulleted">a</listItem>]' +
					'<paragraph>p</paragraph>',

					'<p>p</p>' +
					'<ol>' +
						'<li>a</li>' +
					'</ol>' +
					'<p>p</p>'
				);

				testChangeType(
					'change element at the edge of two different lists #1',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'[<listItem indent="0" type="bulleted">c</listItem>]' +
					'<listItem indent="0" type="numbered">d</listItem>',

					'<ul>' +
						'<li>a</li>' +
						'<li>b</li>' +
					'</ul>' +
					'<ol>' +
						'<li>c</li>' +
						'<li>d</li>' +
					'</ol>'
				);

				testChangeType(
					'change element at the edge of two different lists #1',

					'<listItem indent="0" type="numbered">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<listItem indent="0" type="bulleted">c</listItem>' +
					'<listItem indent="0" type="bulleted">d</listItem>',

					'<ol>' +
						'<li>a</li>' +
						'<li>b</li>' +
					'</ol>' +
					'<ul>' +
						'<li>c</li>' +
						'<li>d</li>' +
					'</ul>'
				);

				testChangeType(
					'change multiple elements #1',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>' +
					'<listItem indent="0" type="bulleted">c</listItem>]' +
					'<listItem indent="0" type="bulleted">d</listItem>',

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<ol>' +
						'<li>b</li>' +
						'<li>c</li>' +
					'</ol>' +
					'<ul>' +
						'<li>d</li>' +
					'</ul>'
				);

				testChangeType(
					'change multiple elements #2',

					'<listItem indent="0" type="numbered">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>' +
					'<listItem indent="0" type="bulleted">c</listItem>]' +
					'<listItem indent="0" type="numbered">d</listItem>',

					'<ol>' +
						'<li>a</li>' +
						'<li>b</li>' +
						'<li>c</li>' +
						'<li>d</li>' +
					'</ol>'
				);
			} );

			describe( 'rename from list item', () => {
				testRenameFromListItem(
					'rename first list item',

					'[<listItem indent="0" type="bulleted">a</listItem>]' +
					'<listItem indent="0" type="bulleted">b</listItem>',

					'<p>a</p>' +
					'<ul>' +
						'<li>b</li>' +
					'</ul>'
				);

				testRenameFromListItem(
					'rename middle list item',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<listItem indent="0" type="bulleted">c</listItem>',

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>b</p>' +
					'<ul>' +
						'<li>c</li>' +
					'</ul>'
				);

				testRenameFromListItem(
					'rename last list item',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]',

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>b</p>'
				);

				testRenameFromListItem(
					'rename only list item',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="bulleted">x</listItem>]' +
					'<paragraph>p</paragraph>',

					'<p>p</p>' +
					'<p>x</p>' +
					'<p>p</p>'
				);
			} );

			describe( 'rename to list item (with attribute change)', () => {
				testRenameToListItem(
					'only paragraph', 0,

					'[<paragraph>a</paragraph>]',

					'<ul>' +
						'<li>a</li>' +
					'</ul>'
				);

				testRenameToListItem(
					'paragraph between paragraphs', 0,

					'<paragraph>x</paragraph>' +
					'[<paragraph>a</paragraph>]' +
					'<paragraph>x</paragraph>',

					'<p>x</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>x</p>'
				);

				testRenameToListItem(
					'element before list of same type', 0,

					'[<paragraph>x</paragraph>]' +
					'<listItem indent="0" type="bulleted">a</listItem>',

					'<ul>' +
						'<li>x</li>' +
						'<li>a</li>' +
					'</ul>'
				);

				testRenameToListItem(
					'element after list of same type', 0,

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<paragraph>x</paragraph>]',

					'<ul>' +
						'<li>a</li>' +
						'<li>x</li>' +
					'</ul>'
				);

				testRenameToListItem(
					'element before list of different type', 0,

					'[<paragraph>x</paragraph>]' +
					'<listItem indent="0" type="numbered">a</listItem>',

					'<ul>' +
						'<li>x</li>' +
					'</ul>' +
					'<ol>' +
						'<li>a</li>' +
					'</ol>'
				);

				testRenameToListItem(
					'element after list of different type', 0,

					'<listItem indent="0" type="numbered">a</listItem>' +
					'[<paragraph>x</paragraph>]',

					'<ol>' +
						'<li>a</li>' +
					'</ol>' +
					'<ul>' +
						'<li>x</li>' +
					'</ul>'
				);

				testRenameToListItem(
					'element between lists of same type', 0,

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<paragraph>x</paragraph>]' +
					'<listItem indent="0" type="bulleted">b</listItem>',

					'<ul>' +
						'<li>a</li>' +
						'<li>x</li>' +
						'<li>b</li>' +
					'</ul>'
				);
			} );

			describe( 'move', () => {
				testMove(
					'list item inside same list',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<listItem indent="0" type="bulleted">c</listItem>',

					4, // Move after last item.

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
						'<li>c</li>' +
						'<li>b</li>' +
					'</ul>'
				);

				testMove(
					'out list item from list',

					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<paragraph>p</paragraph>',

					4, // Move after second paragraph.

					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>p</p>' +
					'<ul>' +
						'<li>b</li>' +
					'</ul>'
				);

				testMove(
					'the only list item',

					'<paragraph>p</paragraph>' +
					'[<listItem indent="0" type="bulleted">a</listItem>]' +
					'<paragraph>p</paragraph>',

					3, // Move after second paragraph.

					'<p>p</p>' +
					'<p>p</p>' +
					'<ul>' +
						'<li>a</li>' +
					'</ul>'
				);

				testMove(
					'list item between two lists of same type',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="bulleted">c</listItem>' +
					'<listItem indent="0" type="bulleted">d</listItem>',

					4, // Move between list item "c" and list item "d'.

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>p</p>' +
					'<ul>' +
						'<li>c</li>' +
						'<li>b</li>' +
						'<li>d</li>' +
					'</ul>'
				);

				testMove(
					'list item between two lists of different type',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<paragraph>p</paragraph>' +
					'<listItem indent="0" type="numbered">c</listItem>' +
					'<listItem indent="0" type="numbered">d</listItem>',

					4, // Move between list item "c" and list item "d'.

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>p</p>' +
					'<ol>' +
						'<li>c</li>' +
					'</ol>' +
					'<ul>' +
						'<li>b</li>' +
					'</ul>' +
					'<ol>' +
						'<li>d</li>' +
					'</ol>'
				);

				testMove(
					'element between list items',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="0" type="bulleted">b</listItem>' +
					'[<paragraph>p</paragraph>]',

					1, // Move between list item "a" and list item "b'.

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>p</p>' +
					'<ul>' +
						'<li>b</li>' +
					'</ul>'
				);
			} );
		} );
	} );

	describe( 'nested lists', () => {
		describe( 'setting data', () => {
			function test( testName, string, expectedString = null ) {
				it( testName, () => {
					editor.setData( string );
					expect( editor.getData() ).to.equal( expectedString || string );
				} );
			}

			test( 'bullet list simple structure',
				'<p>foo</p>' +
				'<ul>' +
					'<li>' +
						'1' +
						'<ul>' +
							'<li>1.1</li>' +
						'</ul>' +
					'</li>' +
				'</ul>' +
				'<p>bar</p>'
			);

			test( 'bullet list deep structure',
				'<p>foo</p>' +
				'<ul>' +
					'<li>' +
						'1' +
						'<ul>' +
							'<li>' +
								'1.1' +
								'<ul><li>1.1.1</li><li>1.1.2</li><li>1.1.3</li><li>1.1.4</li></ul>' +
							'</li>' +
							'<li>' +
								'1.2' +
								'<ul><li>1.2.1</li></ul>' +
							'</li>' +
						'</ul>' +
					'</li>' +
					'<li>2</li>' +
					'<li>' +
						'3' +
						'<ul>' +
							'<li>' +
								'3.1' +
								'<ul>' +
									'<li>' +
										'3.1.1' +
										'<ul><li>3.1.1.1</li></ul>' +
									'</li>' +
									'<li>3.1.2</li>' +
								'</ul>' +
							'</li>' +
						'</ul>' +
					'</li>' +
				'</ul>' +
				'<p>bar</p>'
			);

			test( 'mixed lists deep structure',
				'<p>foo</p>' +
				'<ul>' +
					'<li>' +
						'1' +
						'<ul>' +
							'<li>' +
								'1.1' +
								'<ul><li>1.1.1</li><li>1.1.2</li></ul>' +
								'<ol><li>1.1.3</li><li>1.1.4</li></ol>' +
							'</li>' +
							'<li>' +
								'1.2' +
								'<ul><li>1.2.1</li></ul>' +
							'</li>' +
						'</ul>' +
					'</li>' +
					'<li>2</li>' +
					'<li>' +
						'3' +
						'<ol>' +
							'<li>' +
								'3.1' +
								'<ul>' +
									'<li>' +
										'3.1.1' +
										'<ol><li>3.1.1.1</li></ol>' +
										'<ul><li>3.1.1.2</li></ul>' +
									'</li>' +
									'<li>3.1.2</li>' +
								'</ul>' +
							'</li>' +
						'</ol>' +
						'<ul>' +
							'<li>3.2</li>' +
							'<li>3.3</li>' +
						'</ul>' +
					'</li>' +
				'</ul>' +
				'<p>bar</p>',

				'<p>foo</p>' +
				'<ul>' +
					'<li>' +
						'1' +
						'<ul>' +
							'<li>' +
								'1.1' +
								'<ul><li>1.1.1</li><li>1.1.2</li><li>1.1.3</li><li>1.1.4</li></ul>' +
							'</li>' +
							'<li>' +
								'1.2' +
								'<ul><li>1.2.1</li></ul>' +
							'</li>' +
						'</ul>' +
					'</li>' +
					'<li>2</li>' +
					'<li>' +
						'3' +
						'<ol>' +
							'<li>' +
								'3.1' +
								'<ul>' +
									'<li>' +
										'3.1.1' +
										'<ol><li>3.1.1.1</li><li>3.1.1.2</li></ol>' +
									'</li>' +
									'<li>3.1.2</li>' +
								'</ul>' +
							'</li>' +
							'<li>3.2</li>' +
							'<li>3.3</li>' +
						'</ol>' +
					'</li>' +
				'</ul>' +
				'<p>bar</p>'
			);

			test( 'mixed lists deep structure, white spaces, incorrect content, empty items',
				'<p>foo</p>' +
				'<ul>' +
				'	xxx' +
				'	<li>' +
				'		1' +
				'		<ul>' +
				'			xxx' +
				'			<li>' +
				'				<ul><li></li><li>1.1.2</li></ul>' +
				'				<ol><li>1.1.3</li><li>1.1.4</li></ol>' +		// Will be changed to <ul>.
				'			</li>' +
				'			<li>' +
				'				<ul><li>1.2.1</li></ul>' +
				'			</li>' +
				'			xxx' +
				'		</ul>' +
				'	</li>' +
				'	<li>2</li>' +
				'	<li>' +
				'		<ol>' +
				'			<p>xxx</p>' +
				'			<li>' +
				'				3<strong>.</strong>1' +							// Test multiple text nodes in <li>.
				'				<ul>' +
				'					<li>' +
				'						3.1.1' +
				'						<ol><li>3.1.1.1</li></ol>' +
				'						<ul><li>3.1.1.2</li></ul>' +			// Will be changed to <ol>.
				'					</li>' +
				'					<li>3.1.2</li>' +
				'				</ul>' +
				'			</li>' +
				'		</ol>' +
				'		<p>xxx</p>' +
				'		<ul>' +													// Since <p> gets removed, this will become <ol>.
				'			<li>3.2</li>' +
				'			<li>3.3</li>' +
				'		</ul>' +
				'	</li>' +
				'	<p>xxx</p>' +
				'</ul>' +
				'<p>bar</p>',

				'<p>foo</p>' +
				'<ul>' +
					'<li>' +
						'1' +
						'<ul>' +
							'<li>' +
								'&nbsp;' +
								'<ul>' +
									'<li>&nbsp;</li>' +
									'<li>1.1.2</li>' +
									'<li>1.1.3</li>' +
									'<li>1.1.4</li>' +
								'</ul>' +
							'</li>' +
							'<li>' +
								'&nbsp;' +
								'<ul><li>1.2.1</li></ul>' +
							'</li>' +
						'</ul>' +
					'</li>' +
					'<li>2</li>' +
					'<li>' +
						'&nbsp;' +
						'<ol>' +
							'<li>' +
								'3<strong>.</strong>1' +
								'<ul>' +
									'<li>' +
										'3.1.1' +
										'<ol>' +
											'<li>3.1.1.1</li>' +
											'<li>3.1.1.2</li>' +
										'</ol>' +
									'</li>' +
									'<li>3.1.2</li>' +
								'</ul>' +
							'</li>' +
							'<li>3.2</li>' +
							'<li>3.3</li>' +
						'</ol>' +
					'</li>' +
				'</ul>' +
				'<p>bar</p>'
			);

			it( 'model test for nested lists', () => {
				// <ol> in the middle will be fixed by postfixer to bulleted list.
				editor.setData(
					'<p>foo</p>' +
					'<ul>' +
						'<li>' +
							'1' +
							'<ul>' +
								'<li>1.1</li>' +
							'</ul>' +
							'<ol>' +
								'<li>' +
									'1.2' +
									'<ol>' +
										'<li>1.2.1</li>' +
									'</ol>' +
								'</li>' +
								'<li>1.3</li>' +
							'</ol>' +
						'</li>' +
						'<li>2</li>' +
					'</ul>' +
					'<p>bar</p>'
				);

				const expectedModelData =
					'<paragraph>foo</paragraph>' +
					'<listItem indent="0" type="bulleted">1</listItem>' +
					'<listItem indent="1" type="bulleted">1.1</listItem>' +
					'<listItem indent="1" type="bulleted">1.2</listItem>' +
					'<listItem indent="2" type="numbered">1.2.1</listItem>' +
					'<listItem indent="1" type="bulleted">1.3</listItem>' +
					'<listItem indent="0" type="bulleted">2</listItem>' +
					'<paragraph>bar</paragraph>';

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( expectedModelData );
			} );
		} );

		describe( 'position mapping', () => {
			let mapper;

			beforeEach( () => {
				mapper = editor.editing.mapper;

				editor.setData(
					'<ul>' +
						'<li>a</li>' +
						'<li>' +
							'bbb' +
							'<ol>' +
								'<li>c</li>' +
								'<li>d</li>' +
								'<li>e</li>' +
								'<li>' +
									'<ul>' +
										'<li>g</li>' +
										'<li>h</li>' +
										'<li>i</li>' +
									'</ul>' +
								'</li>' +
								'<li>j</li>' +
							'</ol>' +
						'</li>' +
						'<li>k</li>' +
					'</ol>'
				);
			} );

			/*
				<listItem indent=0 type="bulleted">a</listItem>
				<listItem indent=0 type="bulleted">bbb</listItem>
				<listItem indent=1 type="numbered">c</listItem>
				<listItem indent=1 type="numbered">d</listItem>
				<listItem indent=1 type="numbered">e</listItem>
				<listItem indent=1 type="numbered"></listItem>
				<listItem indent=2 type="bulleted">g</listItem>
				<listItem indent=2 type="bulleted">h</listItem>
				<listItem indent=2 type="bullered">i</listItem>
				<listItem indent=1 type="numbered">j</listItem>
				<listItem indent=0 type="bulleted">k</listItem>
			 */

			describe( 'view to model', () => {
				function test( testName, viewPath, modelPath ) {
					it( testName, () => {
						const viewPos = getViewPosition( viewRoot, viewPath );
						const modelPos = mapper.toModelPosition( viewPos );

						expect( modelPos.root ).to.equal( modelRoot );
						expect( modelPos.path ).to.deep.equal( modelPath );
					} );
				}

				test( 'before ul#1',		[ 0 ],					[ 0 ] );	// --> before listItem "a"
				test( 'before li "a"',		[ 0, 0 ],				[ 0 ] );	// --> before listItem "a"
				test( 'before "a"',			[ 0, 0, 0 ],			[ 0, 0 ] );	// --> beginning of listItem "a"
				test( 'after "a"',			[ 0, 0, 1 ],			[ 0, 1 ] );	// --> end of listItem "a"
				test( 'before li "bbb"',	[ 0, 1 ],				[ 1 ] );	// --> before listItem "bbb"
				test( 'before "bbb"',		[ 0, 1, 0 ],			[ 1, 0 ] );	// --> beginning of listItem "bbb"
				test( 'after "bbb"',		[ 0, 1, 1 ],			[ 1, 3 ] );	// --> end of listItem "bbb"
				test( 'before li "c"',		[ 0, 1, 1, 0 ],			[ 2 ] );	// --> before listItem "c"
				test( 'before "c"',			[ 0, 1, 1, 0, 0 ],		[ 2, 0 ] );	// --> beginning of listItem "c"
				test( 'after "c"',			[ 0, 1, 1, 0, 1 ],		[ 2, 1 ] );	// --> end of listItem "c"
				test( 'before li "d"',		[ 0, 1, 1, 1 ],			[ 3 ] );	// --> before listItem "d"
				test( 'before li "e"',		[ 0, 1, 1, 2 ],			[ 4 ] );	// --> before listItem "e"
				test( 'before "empty" li',	[ 0, 1, 1, 3 ],			[ 5 ] );	// --> before "empty" listItem
				test( 'before ul#2',		[ 0, 1, 1, 3, 0 ],		[ 5, 0 ] ); // --> inside "empty" listItem
				test( 'before li "g"',		[ 0, 1, 1, 3, 0, 0 ],	[ 6 ] );	// --> before listItem "g"
				test( 'before li "h"',		[ 0, 1, 1, 3, 0, 1 ],	[ 7 ] );	// --> before listItem "h"
				test( 'before li "i"',		[ 0, 1, 1, 3, 0, 2 ],	[ 8 ] );	// --> before listItem "i"
				test( 'after li "i"',		[ 0, 1, 1, 3, 0, 3 ],	[ 9 ] );	// --> before listItem "j"
				test( 'after ul#2',			[ 0, 1, 1, 3, 1 ],		[ 9 ] );	// --> before listItem "j"
				test( 'before li "j"',		[ 0, 1, 1, 4 ],			[ 9 ] );	// --> before listItem "j"
				test( 'after li "j"',		[ 0, 1, 1, 5 ],			[ 10 ] );	// --> before listItem "k"
				test( 'end of li "bbb"',	[ 0, 1, 2 ],			[ 10 ] );	// --> before listItem "k"
				test( 'before li "k"',		[ 0, 2 ],				[ 10 ] );	// --> before listItem "k"
				test( 'after li "k"',		[ 0, 3 ],				[ 11 ] );	// --> after listItem "k"
				test( 'after ul',			[ 1 ],					[ 11 ] );	// --> after listItem "k"
			} );

			describe( 'model to view', () => {
				function test( testName, modelPath, viewPath ) {
					it( testName, () => {
						const modelPos = new ModelPosition( modelRoot, modelPath );
						const viewPos = mapper.toViewPosition( modelPos );

						expect( viewPos.root ).to.equal( viewRoot );
						expect( getViewPath( viewPos ) ).to.deep.equal( viewPath );
					} );
				}

				test( 'before listItem "a"',			[ 0 ],		[ 0 ] );				// --> before ul
				test( 'beginning of listItem "a"',		[ 0, 0 ],	[ 0, 0, 0, 0 ] );		// --> beginning of "a" text node
				test( 'end of listItem "a"',			[ 0, 1 ],	[ 0, 0, 0, 1 ] );		// --> end of "a" text node
				test( 'before listItem "bbb"',			[ 1 ],		[ 0, 1 ] );				// --> before li "bbb"
				test( 'beginning of listItem "bbb"',	[ 1, 0 ],	[ 0, 1, 0, 0 ] );		// --> beginning of "bbb" text node
				test( 'end of listItem "bbb"',			[ 1, 3 ],	[ 0, 1, 0, 3 ] );		// --> end of "bbb" text node
				test( 'before listItem "c"',			[ 2 ],		[ 0, 1, 1, 0 ] );		// --> before li "c"
				test( 'beginning of listItem "c"',		[ 2, 0 ],	[ 0, 1, 1, 0, 0, 0 ] );	// --> beginning of "c" text node
				test( 'end of listItem "c"',			[ 2, 1 ],	[ 0, 1, 1, 0, 0, 1 ] );	// --> end of "c" text node
				test( 'before listItem "d"',			[ 3 ],		[ 0, 1, 1, 1 ] );		// --> before li "d"
				test( 'before listItem "e"',			[ 4 ],		[ 0, 1, 1, 2 ] );		// --> before li "e"
				test( 'before "empty" listItem',		[ 5 ],		[ 0, 1, 1, 3 ] );		// --> before "empty" li
				test( 'inside "empty" listItem',		[ 5, 0 ],	[ 0, 1, 1, 3, 0 ] );	// --> before ul
				test( 'before listItem "g"',			[ 6 ],		[ 0, 1, 1, 3, 0, 0 ] );	// --> before li "g"
				test( 'before listItem "h"',			[ 7 ],		[ 0, 1, 1, 3, 0, 1 ] );	// --> before li "h"
				test( 'before listItem "i"',			[ 8 ],		[ 0, 1, 1, 3, 0, 2 ] );	// --> before li "i"
				test( 'before listItem "j"',			[ 9 ],		[ 0, 1, 1, 4 ] );		// --> before li "j"
				test( 'before listItem "k"',			[ 10 ],		[ 0, 2 ] );				// --> before li "k"
				test( 'after listItem "k"',				[ 11 ],		[ 1 ] );				// --> after ul
			} );
		} );

		describe( 'convert changes', () => {
			describe( 'insert', () => {
				describe( 'same list type', () => {
					testInsert(
						'after smaller indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'[<listItem indent="1" type="bulleted">x</listItem>]',

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ul>' +
									'<li>x</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testInsert(
						'after smaller indent, before same indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'[<listItem indent="1" type="bulleted">x</listItem>]' +
						'<listItem indent="1" type="bulleted">1.1</listItem>',

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ul>' +
									'<li>x</li>' +
									'<li>1.1</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testInsert(
						'after smaller indent, before smaller indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'[<listItem indent="1" type="bulleted">x</listItem>]' +
						'<listItem indent="0" type="bulleted">2</listItem>',

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ul>' +
									'<li>x</li>' +
								'</ul>' +
							'</li>' +
							'<li>2</li>' +
						'</ul>'
					);

					testInsert(
						'after same indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'<listItem indent="1" type="bulleted">1.1</listItem>' +
						'[<listItem indent="1" type="bulleted">x</listItem>]',

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ul>' +
									'<li>1.1</li>' +
									'<li>x</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testInsert(
						'after same indent, before bigger indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'[<listItem indent="0" type="bulleted">x</listItem>]' +
						'<listItem indent="1" type="bulleted">1.1</listItem>',

						'<p>p</p>' +
						'<ul>' +
							'<li>1</li>' +
							'<li>' +
								'x' +
								'<ul>' +
									'<li>1.1</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testInsert(
						'after bigger indent, before bigger indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'<listItem indent="1" type="bulleted">1.1</listItem>' +
						'[<listItem indent="0" type="bulleted">x</listItem>]' +
						'<listItem indent="1" type="bulleted">1.2</listItem>',

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ul>' +
									'<li>1.1</li>' +
								'</ul>' +
							'</li>' +
							'<li>' +
								'x' +
								'<ul>' +
									'<li>1.2</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testInsert(
						'list items with too big indent',

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="4" type="bulleted">x</listItem>' + // This indent should be fixed by post fixer.
						'<listItem indent="5" type="bulleted">x</listItem>' + // This indent should be fixed by post fixer.
						'<listItem indent="4" type="bulleted">x</listItem>]' + // This indent should be fixed by post fixer.
						'<listItem indent="1" type="bulleted">c</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>' +
										'b' +
										'<ul>' +
											'<li>' +
												'x' +
												'<ul>' +
													'<li>x</li>' +
												'</ul>' +
											'</li>' +
											'<li>x</li>' +
										'</ul>' +
									'</li>' +
									'<li>c</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);
				} );

				describe( 'different list type', () => {
					testInsert(
						'after smaller indent, before same indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'[<listItem indent="1" type="numbered">x</listItem>]' + // This type should be fixed by post fixer.
						'<listItem indent="1" type="bulleted">1.1</listItem>',

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ol>' +
									'<li>x</li>' +
									'<li>1.1</li>' +
								'</ol>' +
							'</li>' +
						'</ul>'
					);

					testInsert(
						'after same indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'<listItem indent="1" type="bulleted">1.1</listItem>' +
						'[<listItem indent="1" type="numbered">x</listItem>]', // This type should be fixed by post fixer.

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ul>' +
									'<li>1.1</li>' +
									'<li>x</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testInsert(
						'after same indent, before bigger indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'[<listItem indent="0" type="numbered">x</listItem>]' +
						'<listItem indent="1" type="bulleted">1.1</listItem>',

						'<p>p</p>' +
						'<ul>' +
							'<li>1</li>' +
						'</ul>' +
						'<ol>' +
							'<li>' +
								'x' +
								'<ul>' +
									'<li>1.1</li>' +
								'</ul>' +
							'</li>' +
						'</ol>'
					);

					testInsert(
						'after bigger indent, before bigger indent',

						'<paragraph>p</paragraph>' +
						'<listItem indent="0" type="bulleted">1</listItem>' +
						'<listItem indent="1" type="bulleted">1.1</listItem>' +
						'[<listItem indent="0" type="numbered">x</listItem>]' +
						'<listItem indent="1" type="bulleted">1.2</listItem>',

						'<p>p</p>' +
						'<ul>' +
							'<li>' +
								'1' +
								'<ul>' +
									'<li>1.1</li>' +
								'</ul>' +
							'</li>' +
						'</ul>' +
						'<ol>' +
							'<li>' +
								'x' +
								'<ul>' +
									'<li>1.2</li>' +
								'</ul>' +
							'</li>' +
						'</ol>'
					);

					testInsert(
						'after bigger indent, in nested list, different type',

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'<listItem indent="2" type="bulleted">c</listItem>' +
						'[<listItem indent="1" type="numbered">x</listItem>]', // This type should be fixed by post fixer.

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>' +
										'b' +
										'<ul>' +
											'<li>c</li>' +
										'</ul>' +
									'</li>' +
									'<li>x</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);
				} );

				// This case is pretty complex but it tests various edge cases concerning splitting lists.
				testInsert(
					'element between nested list items - complex',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="2" type="bulleted">c</listItem>' +
					'<listItem indent="3" type="numbered">d</listItem>' +
					'[<paragraph>x</paragraph>]' +
					'<listItem indent="3" type="numbered">e</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="2" type="bulleted">f</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="3" type="bulleted">g</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="1" type="bulleted">h</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="2" type="numbered">i</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="0" type="numbered">j</listItem>' + // This indent should be fixed by post fixer.
					'<paragraph>p</paragraph>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>' +
									'b' +
									'<ul>' +
										'<li>' +
											'c' +
											'<ol>' +
												'<li>d</li>' +
											'</ol>' +
										'</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>x</p>' +
					'<ol>' +
						'<li>e</li>' +
					'</ol>' +
					'<ul>' +
						'<li>' +
							'f' +
							'<ul>' +
								'<li>g</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'h' +
							'<ol>' +
								'<li>i</li>' +
							'</ol>' +
						'</li>' +
					'</ul>' +
					'<ol>' +
						'<li>j</li>' +
					'</ol>' +
					'<p>p</p>',

					false
				);

				testInsert(
					'element before indent "hole"',

					'<listItem indent="0" type="bulleted">1</listItem>' +
					'<listItem indent="1" type="bulleted">1.1</listItem>' +
					'[<paragraph>x</paragraph>]' +
					'<listItem indent="2" type="bulleted">1.1.1</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="0" type="bulleted">2</listItem>',

					'<ul>' +
						'<li>' +
							'1' +
							'<ul>' +
								'<li>1.1</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>x</p>' +
					'<ul>' +
						'<li>1.1.1</li>' +
						'<li>2</li>' +
					'</ul>',

					false
				);

				_test(
					'two list items with mismatched types inserted in one batch',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>[]',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
								'<li>c</li>' +
								'<li>d</li>' +
							'</ul>' +
						'</li>' +
					'</ul>',

					() => {
						const item1 = '<listItem indent="1" type="numbered">c</listItem>';
						const item2 = '<listItem indent="1" type="bulleted">d</listItem>';

						model.change( writer => {
							writer.append( parseModel( item1, model.schema ), modelRoot );
							writer.append( parseModel( item2, model.schema ), modelRoot );
						} );
					}
				);
			} );

			describe( 'remove', () => {
				testRemove(
					'the first nested item',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="1" type="bulleted">b</listItem>]' +
					'<listItem indent="1" type="bulleted">c</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>c</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'nested item from the middle',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="1" type="bulleted">c</listItem>]' +
					'<listItem indent="1" type="bulleted">d</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
								'<li>d</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'the last nested item',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="1" type="bulleted">c</listItem>]',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'the only nested item',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="1" type="bulleted">c</listItem>]',

					'<ul>' +
						'<li>a</li>' +
					'</ul>'
				);

				testRemove(
					'list item that separates two nested lists of same type',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="numbered">b</listItem>' +
					'[<listItem indent="0" type="bulleted">c</listItem>]' +
					'<listItem indent="1" type="numbered">d</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ol>' +
								'<li>b</li>' +
								'<li>d</li>' +
							'</ol>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'list item that separates two nested lists of different type',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="numbered">b</listItem>' +
					'[<listItem indent="0" type="bulleted">c</listItem>]' +
					'<listItem indent="1" type="bulleted">d</listItem>', // This type should be fixed by post fixer.

					'<ul>' +
						'<li>' +
							'a' +
							'<ol>' +
								'<li>b</li>' +
								'<li>d</li>' +
							'</ol>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'item that has nested lists, previous item has same indent',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="0" type="bulleted">b</listItem>]' +
					'<listItem indent="1" type="bulleted">c</listItem>' +
					'<listItem indent="1" type="bulleted">d</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>c</li>' +
								'<li>d</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'item that has nested lists, previous item has smaller indent',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="1" type="bulleted">b</listItem>]' +
					'<listItem indent="2" type="bulleted">c</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="2" type="bulleted">d</listItem>', // This indent should be fixed by post fixer.

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>c</li>' +
								'<li>d</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'item that has nested lists, previous item has bigger indent by 1',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="0" type="bulleted">c</listItem>]' +
					'<listItem indent="1" type="bulleted">d</listItem>' +
					'<listItem indent="2" type="numbered">e</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
								'<li>' +
									'd' +
									'<ol>' +
										'<li>e</li>' +
									'</ol>' +
								'</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'item that has nested lists, previous item has bigger indent by 2',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="2" type="bulleted">c</listItem>' +
					'[<listItem indent="0" type="bulleted">d</listItem>]' +
					'<listItem indent="1" type="bulleted">e</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>' +
									'b' +
									'<ul>' +
										'<li>c</li>' +
									'</ul>' +
								'</li>' +
								'<li>e</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRemove(
					'first list item that has nested list',

					'[<listItem indent="0" type="bulleted">a</listItem>]' +
					'<listItem indent="1" type="bulleted">b</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="2" type="bulleted">c</listItem>', // This indent should be fixed by post fixer.

					'<ul>' +
						'<li>' +
							'b' +
							'<ul>' +
								'<li>c</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);
			} );

			describe( 'change type', () => {
				testChangeType(
					'list item that has nested items',

					'[<listItem indent="0" type="numbered">a</listItem>]' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="1" type="bulleted">c</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
								'<li>c</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				// The change will be "prevented" by post fixer.
				testChangeType(
					'list item that is a nested item',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="numbered">b</listItem>' +
					'[<listItem indent="1" type="numbered">c</listItem>]' +
					'<listItem indent="1" type="numbered">d</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ol>' +
								'<li>b</li>' +
								'<li>c</li>' +
								'<li>d</li>' +
							'</ol>' +
						'</li>' +
					'</ul>'
				);
			} );

			describe( 'change indent', () => {
				describe( 'same list type', () => {
					testChangeIndent(
						'indent last item of flat list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'[<listItem indent="0" type="bulleted">b</listItem>]',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'indent middle item of flat list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'[<listItem indent="0" type="bulleted">b</listItem>]' +
						'<listItem indent="0" type="bulleted">c</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
								'</ul>' +
							'</li>' +
							'<li>c</li>' +
						'</ul>'
					);

					testChangeIndent(
						'indent last item in nested list', 2,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="1" type="bulleted">c</listItem>]',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>' +
										'b' +
										'<ul>' +
											'<li>c</li>' +
										'</ul>' +
									'</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'indent middle item in nested list', 2,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="1" type="bulleted">c</listItem>]' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>' +
										'b' +
										'<ul>' +
											'<li>c</li>' +
										'</ul>' +
									'</li>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					// Keep in mind that this test is different than "executing command on item that has nested list".
					// A command is automatically indenting nested items so the hierarchy is preserved.
					// Here we test conversion and the change is simple changing indent of one item.
					// This may be true also for other tests in this suite, keep this in mind.
					testChangeIndent(
						'indent item that has nested list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'[<listItem indent="0" type="bulleted">b</listItem>]' +
						'<listItem indent="1" type="bulleted">c</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
									'<li>c</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'indent item that in view is a next sibling of item that has nested list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="0" type="bulleted">c</listItem>]' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
									'<li>c</li>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent the first item of nested list', 0,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'[<listItem indent="1" type="bulleted">b</listItem>]' +
						'<listItem indent="1" type="bulleted">c</listItem>' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>a</li>' +
							'<li>' +
								'b' +
								'<ul>' +
									'<li>c</li>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent item from the middle of nested list', 0,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="1" type="bulleted">c</listItem>]' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
								'</ul>' +
							'</li>' +
							'<li>' +
								'c' +
								'<ul>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent the last item of nested list', 0,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="1" type="bulleted">c</listItem>]',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
								'</ul>' +
							'</li>' +
							'<li>c</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent the only item of nested list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="2" type="bulleted">c</listItem>]' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
									'<li>c</li>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent item by two', 0,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="2" type="bulleted">c</listItem>]' +
						'<listItem indent="0" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
								'</ul>' +
							'</li>' +
							'<li>c</li>' +
							'<li>d</li>' +
						'</ul>'
					);
				} );

				describe( 'different list type', () => {
					testChangeIndent(
						'indent middle item of flat list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'[<listItem indent="0" type="numbered">b</listItem>]' +
						'<listItem indent="0" type="bulleted">c</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ol>' +
									'<li>b</li>' +
								'</ol>' +
							'</li>' +
							'<li>c</li>' +
						'</ul>'
					);

					testChangeIndent(
						'indent item that has nested list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'[<listItem indent="0" type="numbered">b</listItem>]' +
						'<listItem indent="1" type="bulleted">c</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ol>' +
									'<li>b</li>' +
									'<li>c</li>' +
								'</ol>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'indent item that in view is a next sibling of item that has nested list #1', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="0" type="numbered">c</listItem>]' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
									'<li>c</li>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent the first item of nested list', 0,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'[<listItem indent="1" type="bulleted">b</listItem>]' +
						'<listItem indent="1" type="bulleted">c</listItem>' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>a</li>' +
							'<li>' +
								'b' +
								'<ul>' +
									'<li>c</li>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent the only item of nested list', 1,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="2" type="bulleted">c</listItem>]' +
						'<listItem indent="1" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
									'<li>c</li>' +
									'<li>d</li>' +
								'</ul>' +
							'</li>' +
						'</ul>'
					);

					testChangeIndent(
						'outdent item by two', 0,

						'<listItem indent="0" type="bulleted">a</listItem>' +
						'<listItem indent="1" type="bulleted">b</listItem>' +
						'[<listItem indent="2" type="numbered">c</listItem>]' +
						'<listItem indent="0" type="bulleted">d</listItem>',

						'<ul>' +
							'<li>' +
								'a' +
								'<ul>' +
									'<li>b</li>' +
								'</ul>' +
							'</li>' +
						'</ul>' +
						'<ol>' +
							'<li>c</li>' +
						'</ol>' +
						'<ul>' +
							'<li>d</li>' +
						'</ul>'
					);
				} );
			} );

			describe( 'rename from list item', () => {
				testRenameFromListItem(
					'rename nested item from the middle #1',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="1" type="bulleted">c</listItem>]' +
					'<listItem indent="1" type="bulleted">d</listItem>', // This indent should be fixed by post fixer.

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>c</p>' +
					'<ul>' +
						'<li>d</li>' +
					'</ul>',

					false
				);

				testRenameFromListItem(
					'rename nested item from the middle #2 - nightmare example',

					// Indents in this example should be fixed by post fixer.
					// This nightmare example checks if structure of the list is kept as intact as possible.
					'<listItem indent="0" type="bulleted">a</listItem>' +	// a --------			-->  a --------
					'<listItem indent="1" type="bulleted">b</listItem>' +	//   b --------			-->    b --------
					'[<listItem indent="2" type="bulleted">c</listItem>]' +	//     c --------		--> --------
					'<listItem indent="3" type="bulleted">d</listItem>' +	//       d --------		-->  d --------
					'<listItem indent="3" type="bulleted">e</listItem>' +	//       e --------		-->  e --------
					'<listItem indent="4" type="bulleted">f</listItem>' +	//         f --------	-->    f --------
					'<listItem indent="2" type="bulleted">g</listItem>' +	//     g --------		-->  g --------
					'<listItem indent="3" type="bulleted">h</listItem>' +	//       h --------		-->    h --------
					'<listItem indent="4" type="bulleted">i</listItem>' +	//         i --------	-->      i --------
					'<listItem indent="1" type="bulleted">j</listItem>' +	//   j --------			-->  j --------
					'<listItem indent="2" type="bulleted">k</listItem>' +	//     k --------		-->    k --------
					'<listItem indent="0" type="bulleted">l</listItem>' +	// l --------			-->  l --------
					'<listItem indent="1" type="bulleted">m</listItem>',	//   m --------			-->    m --------

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>c</p>' +
					'<ul>' +
						'<li>d</li>' +
						'<li>' +
							'e' +
							'<ul>' +
								'<li>f</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'g' +
							'<ul>' +
								'<li>' +
									'h' +
									'<ul>' +
										'<li>i</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'j' +
							'<ul>' +
								'<li>k</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'l' +
							'<ul>' +
								'<li>m</li>' +
							'</ul>' +
						'</li>' +
					'</ul>',

					false
				);

				testRenameFromListItem(
					'rename nested item from the middle #3 - manual test example',

					// Indents in this example should be fixed by post fixer.
					// This example checks a bug found by testing manual test.
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="2" type="bulleted">c</listItem>]' +
					'<listItem indent="1" type="bulleted">d</listItem>' +
					'<listItem indent="2" type="bulleted">e</listItem>' +
					'<listItem indent="2" type="bulleted">f</listItem>' +
					'<listItem indent="2" type="bulleted">g</listItem>' +
					'<listItem indent="2" type="bulleted">h</listItem>' +
					'<listItem indent="0" type="bulleted"></listItem>' +
					'<listItem indent="1" type="bulleted"></listItem>' +
					'<listItem indent="2" type="numbered">k</listItem>' +
					'<listItem indent="2" type="numbered">l</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>c</p>' +
					'<ul>' +
						'<li>' +
							'd' +
							'<ul>' +
								'<li>e</li>' +
								'<li>f</li>' +
								'<li>g</li>' +
								'<li>h</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'<ul>' +
								'<li>' +
									'<ol>' +
										'<li>k</li>' +
										'<li>l</li>' +
									'</ol>' +
								'</li>' +
							'</ul>' +
						'</li>' +
					'</ul>',

					false
				);

				testRenameFromListItem(
					'rename the only nested item',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="1" type="bulleted">b</listItem>]',

					'<ul>' +
						'<li>a</li>' +
					'</ul>' +
					'<p>b</p>'
				);
			} );

			describe( 'rename to list item (with attribute change)', () => {
				testRenameToListItem(
					'element into first item in nested list', 1,

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<paragraph>b</paragraph>]',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRenameToListItem(
					'element into last item in nested list', 1,

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<paragraph>c</paragraph>]',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
								'<li>c</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testRenameToListItem(
					'element into a first item in deeply nested list', 2,

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<paragraph>c</paragraph>]' +
					'<listItem indent="0" type="bulleted">d</listItem>',

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>' +
									'b' +
									'<ul>' +
										'<li>c</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
						'<li>d</li>' +
					'</ul>'
				);
			} );

			describe( 'move', () => {
				// Since move is in fact remove + insert and does not event have its own converter, only a few cases will be tested here.
				testMove(
					'out nested list items',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'[<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="2" type="bulleted">c</listItem>]' +
					'<listItem indent="3" type="bulleted">d</listItem>' + // This indent should be fixed by post fixer.
					'<listItem indent="4" type="bulleted">e</listItem>' + // This indent should be fixed by post fixer.
					'<paragraph>x</paragraph>',

					6,

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>' +
									'd' +
									'<ul>' +
										'<li>e</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>x</p>' +
					'<ul>' +
						'<li>' +
							'b' +
							'<ul>' +
								'<li>c</li>' +
							'</ul>' +
						'</li>' +
					'</ul>'
				);

				testMove(
					'nested list items between lists of same type',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="2" type="bulleted">c</listItem>' +
					'<listItem indent="3" type="bulleted">d</listItem>]' +
					'<listItem indent="4" type="bulleted">e</listItem>' +
					'<paragraph>x</paragraph>' +
					'<listItem indent="0" type="bulleted">f</listItem>' +
					'<listItem indent="0" type="bulleted">g</listItem>',

					7,

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>' +
									'b' +
									'<ul>' +
										'<li>e</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>x</p>' +
					'<ul>' +
						'<li>' +
							'f' +
							'<ul>' +
								'<li>' +
									'c' +
									'<ul>' +
										'<li>d</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
						'<li>g</li>' +
					'</ul>'
				);

				testMove(
					'nested list items between lists of different type',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="2" type="bulleted">c</listItem>' +
					'<listItem indent="3" type="bulleted">d</listItem>]' +
					'<listItem indent="4" type="bulleted">e</listItem>' +
					'<paragraph>x</paragraph>' +
					'<listItem indent="0" type="numbered">f</listItem>' +
					'<listItem indent="1" type="numbered">g</listItem>',

					7,

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>' +
									'b' +
									'<ul>' +
										'<li>e</li>' +
									'</ul>' +
								'</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>x</p>' +
					'<ol>' +
						'<li>' +
							'f' +
							'<ul>' +
								'<li>' +
									'c' +
									'<ul>' +
										'<li>d</li>' +
									'</ul>' +
								'</li>' +
								'<li>g</li>' +
							'</ul>' +
						'</li>' +
					'</ol>'
				);

				testMove(
					'element between nested list',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="2" type="bulleted">c</listItem>' +
					'<listItem indent="3" type="bulleted">d</listItem>' +
					'[<paragraph>x</paragraph>]',

					2,

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
							'</ul>' +
						'</li>' +
					'</ul>' +
					'<p>x</p>' +
					'<ul>' +
						'<li>' +
							'c' +
							'<ul>' +
								'<li>d</li>' +
							'</ul>' +
						'</li>' +
					'</ul>',

					false
				);

				testMove(
					'multiple nested list items of different types #1 - fix at start',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="1" type="bulleted">c</listItem>' +
					'<listItem indent="0" type="bulleted">d</listItem>' +
					'<listItem indent="1" type="numbered">e</listItem>]' +
					'<listItem indent="1" type="numbered">f</listItem>' +
					'<listItem indent="0" type="bulleted">g</listItem>' +
					'<listItem indent="1" type="numbered">h</listItem>' +
					'<listItem indent="1" type="numbered">i</listItem>',

					8,

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
								'<li>f</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'g' +
							'<ol>' +
								'<li>h</li>' +
								'<li>c</li>' +
							'</ol>' +
						'</li>' +
						'<li>' +
							'd' +
							'<ol>' +
								'<li>e</li>' +
								'<li>i</li>' +
							'</ol>' +
						'</li>' +
					'</ul>'
				);

				testMove(
					'multiple nested list items of different types #2 - fix at end',

					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="1" type="bulleted">c</listItem>' +
					'<listItem indent="0" type="bulleted">d</listItem>' +
					'<listItem indent="1" type="numbered">e</listItem>]' +
					'<listItem indent="1" type="numbered">f</listItem>' +
					'<listItem indent="0" type="bulleted">g</listItem>' +
					'<listItem indent="1" type="bulleted">h</listItem>' +
					'<listItem indent="1" type="bulleted">i</listItem>',

					8,

					'<ul>' +
						'<li>' +
							'a' +
							'<ul>' +
								'<li>b</li>' +
								'<li>f</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'g' +
							'<ul>' +
								'<li>h</li>' +
								'<li>c</li>' +
							'</ul>' +
						'</li>' +
						'<li>' +
							'd' +
							'<ol>' +
								'<li>e</li>' +
								'<li>i</li>' +
							'</ol>' +
						'</li>' +
					'</ul>'
				);
			} );
		} );
	} );

	describe( 'post fixer', () => {
		describe( 'insert', () => {
			function test( testName, input, inserted, output ) {
				it( testName, () => {
					setModelData( model, input );

					model.change( writer => {
						writer.insert( parseModel( inserted, model.schema ), modelDoc.selection.getFirstPosition() );
					} );

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
				} );
			}

			test(
				'element before nested list',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[]' +
				'<listItem indent="2" type="bulleted">d</listItem>' +
				'<listItem indent="2" type="bulleted">e</listItem>' +
				'<listItem indent="3" type="bulleted">f</listItem>',

				'<paragraph>x</paragraph>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<paragraph>x</paragraph>' +
				'<listItem indent="0" type="bulleted">d</listItem>' +
				'<listItem indent="0" type="bulleted">e</listItem>' +
				'<listItem indent="1" type="bulleted">f</listItem>'
			);

			test(
				'list item before nested list',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[]' +
				'<listItem indent="2" type="bulleted">d</listItem>' +
				'<listItem indent="2" type="bulleted">e</listItem>' +
				'<listItem indent="3" type="bulleted">f</listItem>',

				'<listItem indent="0" type="bulleted">x</listItem>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="0" type="bulleted">x</listItem>' +
				'<listItem indent="1" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="bulleted">e</listItem>' +
				'<listItem indent="2" type="bulleted">f</listItem>'
			);

			test(
				'multiple list items with too big indent',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[]' +
				'<listItem indent="1" type="bulleted">c</listItem>',

				'<listItem indent="4" type="bulleted">x</listItem>' +
				'<listItem indent="5" type="bulleted">x</listItem>' +
				'<listItem indent="4" type="bulleted">x</listItem>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="2" type="bulleted">x</listItem>' +
				'<listItem indent="3" type="bulleted">x</listItem>' +
				'<listItem indent="2" type="bulleted">x</listItem>' +
				'<listItem indent="1" type="bulleted">c</listItem>'
			);

			test(
				'item with different type - top level list',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="0" type="bulleted">b</listItem>' +
				'[]' +
				'<listItem indent="0" type="bulleted">c</listItem>',

				'<listItem indent="0" type="numbered">x</listItem>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="0" type="bulleted">b</listItem>' +
				'<listItem indent="0" type="numbered">x</listItem>' +
				'<listItem indent="0" type="bulleted">c</listItem>'
			);

			test(
				'multiple items with different type - nested list',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[]' +
				'<listItem indent="2" type="bulleted">c</listItem>',

				'<listItem indent="1" type="numbered">x</listItem>' +
				'<listItem indent="2" type="numbered">x</listItem>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="1" type="bulleted">x</listItem>' +
				'<listItem indent="2" type="numbered">x</listItem>' +
				'<listItem indent="2" type="numbered">c</listItem>'
			);

			test(
				'item with different type, in nested list, after nested list',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="2" type="bulleted">c</listItem>' +
				'[]',

				'<listItem indent="1" type="numbered">x</listItem>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="2" type="bulleted">c</listItem>' +
				'<listItem indent="1" type="bulleted">x</listItem>'
			);

			it( 'two list items with mismatched types inserted in one batch', () => {
				const input =
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>';

				const output =
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="1" type="bulleted">c</listItem>' +
					'<listItem indent="1" type="bulleted">d</listItem>';

				setModelData( model, input );

				const item1 = '<listItem indent="1" type="numbered">c</listItem>';
				const item2 = '<listItem indent="1" type="bulleted">d</listItem>';

				model.change( writer => {
					writer.append( parseModel( item1, model.schema ), modelRoot );
					writer.append( parseModel( item2, model.schema ), modelRoot );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
			} );
		} );

		describe( 'remove', () => {
			function test( testName, input, output ) {
				it( testName, () => {
					setModelData( model, input );

					model.change( writer => {
						writer.remove( modelDoc.selection.getFirstRange() );
					} );

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
				} );
			}

			test(
				'first list item',

				'[<listItem indent="0" type="bulleted">a</listItem>]' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="2" type="bulleted">c</listItem>',

				'<listItem indent="0" type="bulleted">b</listItem>' +
				'<listItem indent="1" type="bulleted">c</listItem>'
			);

			test(
				'first list item of nested list',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'[<listItem indent="1" type="bulleted">b</listItem>]' +
				'<listItem indent="2" type="bulleted">c</listItem>' +
				'<listItem indent="3" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="bulleted">e</listItem>' +
				'<listItem indent="2" type="bulleted">f</listItem>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">c</listItem>' +
				'<listItem indent="2" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="bulleted">e</listItem>' +
				'<listItem indent="2" type="bulleted">f</listItem>'
			);

			test(
				'selection over two different nested lists of same indent',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[<listItem indent="1" type="bulleted">c</listItem>' +
				'<listItem indent="0" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="numbered">e</listItem>]' +
				'<listItem indent="1" type="numbered">f</listItem>',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="1" type="bulleted">f</listItem>'
			);
		} );

		describe( 'move', () => {
			function test( testName, input, offset, output ) {
				it( testName, () => {
					setModelData( model, input );

					const targetPosition = ModelPosition.createAt( modelRoot, offset );

					model.change( writer => {
						writer.move( modelDoc.selection.getFirstRange(), targetPosition );
					} );

					expect( getModelData( model, { withoutSelection: true } ) ).to.equal( output );
				} );
			}

			test(
				'nested list item out of list structure',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'[<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="2" type="bulleted">c</listItem>]' +
				'<listItem indent="3" type="bulleted">d</listItem>' +
				'<listItem indent="4" type="bulleted">e</listItem>' +
				'<paragraph>x</paragraph>',

				6,

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">d</listItem>' +
				'<listItem indent="2" type="bulleted">e</listItem>' +
				'<paragraph>x</paragraph>' +
				'<listItem indent="0" type="bulleted">b</listItem>' +
				'<listItem indent="1" type="bulleted">c</listItem>'
			);

			test(
				'list items between lists',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[<listItem indent="2" type="bulleted">c</listItem>' +
				'<listItem indent="3" type="bulleted">d</listItem>]' +
				'<listItem indent="4" type="bulleted">e</listItem>' +
				'<paragraph>x</paragraph>' +
				'<listItem indent="0" type="bulleted">f</listItem>' +
				'<listItem indent="0" type="bulleted">g</listItem>',

				7,

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="2" type="bulleted">e</listItem>' +
				'<paragraph>x</paragraph>' +
				'<listItem indent="0" type="bulleted">f</listItem>' +
				'<listItem indent="1" type="bulleted">c</listItem>' +
				'<listItem indent="2" type="bulleted">d</listItem>' +
				'<listItem indent="0" type="bulleted">g</listItem>'
			);

			test(
				'element in between nested list items',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="2" type="bulleted">c</listItem>' +
				'<listItem indent="3" type="bulleted">d</listItem>' +
				'[<paragraph>x</paragraph>]',

				2,

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<paragraph>x</paragraph>' +
				'<listItem indent="0" type="bulleted">c</listItem>' +
				'<listItem indent="1" type="bulleted">d</listItem>'
			);

			test(
				'multiple nested list items of different types #1 - fix at start',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[<listItem indent="1" type="bulleted">c</listItem>' +
				'<listItem indent="0" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="numbered">e</listItem>]' +
				'<listItem indent="1" type="numbered">f</listItem>' +
				'<listItem indent="0" type="bulleted">g</listItem>' +
				'<listItem indent="1" type="numbered">h</listItem>' +
				'<listItem indent="1" type="numbered">i</listItem>',

				8,

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="1" type="bulleted">f</listItem>' +
				'<listItem indent="0" type="bulleted">g</listItem>' +
				'<listItem indent="1" type="numbered">h</listItem>' +
				'<listItem indent="1" type="numbered">c</listItem>' +
				'<listItem indent="0" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="numbered">e</listItem>' +
				'<listItem indent="1" type="numbered">i</listItem>'
			);

			test(
				'multiple nested list items of different types #2 - fix at end',

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'[<listItem indent="1" type="bulleted">c</listItem>' +
				'<listItem indent="0" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="numbered">e</listItem>]' +
				'<listItem indent="1" type="numbered">f</listItem>' +
				'<listItem indent="0" type="bulleted">g</listItem>' +
				'<listItem indent="1" type="bulleted">h</listItem>' +
				'<listItem indent="1" type="bulleted">i</listItem>',

				8,

				'<listItem indent="0" type="bulleted">a</listItem>' +
				'<listItem indent="1" type="bulleted">b</listItem>' +
				'<listItem indent="1" type="bulleted">f</listItem>' +
				'<listItem indent="0" type="bulleted">g</listItem>' +
				'<listItem indent="1" type="bulleted">h</listItem>' +
				'<listItem indent="1" type="bulleted">c</listItem>' +
				'<listItem indent="0" type="bulleted">d</listItem>' +
				'<listItem indent="1" type="numbered">e</listItem>' +
				'<listItem indent="1" type="numbered">i</listItem>'
			);

			// #78.
			test(
				'move out of container',

				'<blockQuote>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="1" type="bulleted">c</listItem>' +
					'<listItem indent="1" type="bulleted">d</listItem>' +
					'[<listItem indent="2" type="bulleted">e</listItem>]' +
				'</blockQuote>',

				0,

				'<listItem indent="0" type="bulleted">e</listItem>' +
				'<blockQuote>' +
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<listItem indent="1" type="bulleted">c</listItem>' +
					'<listItem indent="1" type="bulleted">d</listItem>' +
				'</blockQuote>'
			);
		} );

		describe( 'rename', () => {
			it( 'rename nested item', () => {
				const modelBefore =
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'[<listItem indent="2" type="bulleted">c</listItem>]' +
					'<listItem indent="2" type="bulleted">d</listItem>' +
					'<listItem indent="3" type="bulleted">e</listItem>' +
					'<listItem indent="1" type="bulleted">f</listItem>' +
					'<listItem indent="2" type="bulleted">g</listItem>' +
					'<listItem indent="1" type="bulleted">h</listItem>' +
					'<listItem indent="2" type="bulleted">i</listItem>';

				const expectedModel =
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<paragraph>c</paragraph>' +
					'<listItem indent="0" type="bulleted">d</listItem>' +
					'<listItem indent="1" type="bulleted">e</listItem>' +
					'<listItem indent="0" type="bulleted">f</listItem>' +
					'<listItem indent="1" type="bulleted">g</listItem>' +
					'<listItem indent="0" type="bulleted">h</listItem>' +
					'<listItem indent="1" type="bulleted">i</listItem>';

				setModelData( model, modelBefore );

				const element = modelDoc.selection.getFirstPosition().nodeAfter;

				model.change( writer => {
					writer.rename( element, 'paragraph' );
				} );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( expectedModel );
			} );

			it( 'should not remove attributes from elements that allows that attributes', () => {
				const modelBefore =
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<foo indent="baz" type="bar"></foo>';

				const expectedModel =
					'<listItem indent="0" type="bulleted">a</listItem>' +
					'<listItem indent="1" type="bulleted">b</listItem>' +
					'<foo indent="baz" type="bar"></foo>';

				setModelData( model, modelBefore );

				expect( getModelData( model, { withoutSelection: true } ) ).to.equal( expectedModel );
			} );
		} );
	} );

	describe( 'paste and insertContent integration', () => {
		it( 'should be triggered on DataController#insertContent()', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A</listItem>' +
				'<listItem type="bulleted" indent="1">B[]</listItem>' +
				'<listItem type="bulleted" indent="2">C</listItem>'
			);

			editor.model.insertContent(
				parseModel(
					'<listItem type="bulleted" indent="0">X</listItem>' +
					'<listItem type="bulleted" indent="1">Y</listItem>',
					model.schema
				),
				modelDoc.selection
			);

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">A</listItem>' +
				'<listItem indent="1" type="bulleted">BX</listItem>' +
				'<listItem indent="2" type="bulleted">Y[]</listItem>' +
				'<listItem indent="2" type="bulleted">C</listItem>'
			);
		} );

		// Just checking that it doesn't crash. #69
		it( 'should work if an element is passed to DataController#insertContent()', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A</listItem>' +
				'<listItem type="bulleted" indent="1">B[]</listItem>' +
				'<listItem type="bulleted" indent="2">C</listItem>'
			);

			editor.model.insertContent(
				new ModelElement( 'listItem', { type: 'bulleted', indent: '0' }, 'X' ),
				modelDoc.selection
			);

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">A</listItem>' +
				'<listItem indent="1" type="bulleted">BX[]</listItem>' +
				'<listItem indent="2" type="bulleted">C</listItem>'
			);
		} );

		// Just checking that it doesn't crash. #69
		it( 'should work if an element is passed to DataController#insertContent()', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A</listItem>' +
				'<listItem type="bulleted" indent="1">B[]</listItem>' +
				'<listItem type="bulleted" indent="2">C</listItem>'
			);

			editor.model.insertContent(
				new ModelText( 'X' ),
				modelDoc.selection
			);

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">A</listItem>' +
				'<listItem indent="1" type="bulleted">BX[]</listItem>' +
				'<listItem indent="2" type="bulleted">C</listItem>'
			);
		} );

		it( 'should fix indents of pasted list items', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A</listItem>' +
				'<listItem type="bulleted" indent="1">B[]</listItem>' +
				'<listItem type="bulleted" indent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">A</listItem>' +
				'<listItem indent="1" type="bulleted">BX</listItem>' +
				'<listItem indent="2" type="bulleted">Y[]</listItem>' +
				'<listItem indent="2" type="bulleted">C</listItem>'
			);
		} );

		it( 'should not fix indents of list items that are separated by non-list element', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A</listItem>' +
				'<listItem type="bulleted" indent="1">B[]</listItem>' +
				'<listItem type="bulleted" indent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>W<ul><li>X</li></ul></li></ul><p>Y</p><ul><li>Z</li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">A</listItem>' +
				'<listItem indent="1" type="bulleted">BW</listItem>' +
				'<listItem indent="2" type="bulleted">X</listItem>' +
				'<paragraph>Y</paragraph>' +
				'<listItem indent="0" type="bulleted">Z[]</listItem>' +
				'<listItem indent="1" type="bulleted">C</listItem>'
			);
		} );

		it( 'should co-work correctly with post fixer', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A</listItem>' +
				'<listItem type="bulleted" indent="1">B[]</listItem>' +
				'<listItem type="bulleted" indent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<p>X</p><ul><li>Y</li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">A</listItem>' +
				'<listItem indent="1" type="bulleted">BX</listItem>' +
				'<listItem indent="0" type="bulleted">Y[]</listItem>' +
				'<listItem indent="1" type="bulleted">C</listItem>'
			);
		} );

		it( 'should work if items are pasted between listItem elements', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A</listItem>' +
				'<listItem type="bulleted" indent="1">B</listItem>[]' +
				'<listItem type="bulleted" indent="2">C</listItem>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">A</listItem>' +
				'<listItem indent="1" type="bulleted">B</listItem>' +
				'<listItem indent="1" type="bulleted">X</listItem>' +
				'<listItem indent="2" type="bulleted">Y[]</listItem>' +
				'<listItem indent="2" type="bulleted">C</listItem>'
			);
		} );

		it( 'should create correct model when list items are pasted in top-level list', () => {
			setModelData( model,
				'<listItem type="bulleted" indent="0">A[]</listItem>' +
				'<listItem type="bulleted" indent="1">B</listItem>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<listItem indent="0" type="bulleted">AX</listItem>' +
				'<listItem indent="1" type="bulleted">Y[]</listItem>' +
				'<listItem indent="1" type="bulleted">B</listItem>'
			);
		} );

		it( 'should create correct model when list items are pasted in non-list context', () => {
			setModelData( model,
				'<paragraph>A[]</paragraph>' +
				'<paragraph>B</paragraph>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<ul><li>X<ul><li>Y</li></ul></li></ul>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>AX</paragraph>' +
				'<listItem indent="0" type="bulleted">Y[]</listItem>' +
				'<paragraph>B</paragraph>'
			);
		} );

		it( 'should not crash when "empty content" is inserted', () => {
			setModelData( model, '<paragraph>[]</paragraph>' );

			expect( () => {
				editor.model.insertContent( new ModelDocumentFragment(), modelDoc.selection );
			} ).not.to.throw();
		} );

		it( 'should correctly handle item that is pasted without its parent', () => {
			setModelData( model,
				'<paragraph>Foo</paragraph>' +
				'<listItem type="numbered" indent="0">A</listItem>' +
				'<listItem type="numbered" indent="1">B</listItem>' +
				'[]' +
				'<paragraph>Bar</paragraph>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<li>X</li>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>Foo</paragraph>' +
				'<listItem indent="0" type="numbered">A</listItem>' +
				'<listItem indent="1" type="numbered">B</listItem>' +
				'<listItem indent="1" type="numbered">X[]</listItem>' +
				'<paragraph>Bar</paragraph>'
			);
		} );

		it( 'should correctly handle item that is pasted without its parent #2', () => {
			setModelData( model,
				'<paragraph>Foo</paragraph>' +
				'<listItem type="numbered" indent="0">A</listItem>' +
				'<listItem type="numbered" indent="1">B</listItem>' +
				'[]' +
				'<paragraph>Bar</paragraph>'
			);

			const clipboard = editor.plugins.get( 'Clipboard' );

			clipboard.fire( 'inputTransformation', {
				content: parseView( '<li>X<ul><li>Y</li></ul></li>' )
			} );

			expect( getModelData( model ) ).to.equal(
				'<paragraph>Foo</paragraph>' +
				'<listItem indent="0" type="numbered">A</listItem>' +
				'<listItem indent="1" type="numbered">B</listItem>' +
				'<listItem indent="1" type="numbered">X</listItem>' +
				'<listItem indent="2" type="bulleted">Y[]</listItem>' +
				'<paragraph>Bar</paragraph>'
			);
		} );
	} );

	describe( 'other', () => {
		it( 'model insert converter should not fire if change was already consumed', () => {
			editor.editing.downcastDispatcher.on( 'insert:listItem', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.item, 'attribute:type' );
				conversionApi.consumable.consume( data.item, 'attribute:indent' );

				const converter = insertElement( ( modelElement, viewWriter ) => viewWriter.createContainerElement( 'p' ) );

				return converter( evt, data, conversionApi );
			}, { priority: 'highest' } );

			// Paragraph is needed, otherwise selection throws.
			setModelData( model, '<paragraph>x</paragraph><listItem indent="0" type="bulleted">y</listItem>' );

			expect( getViewData( editor.editing.view, { withoutSelection: true } ) ).to.equal( '<p>x</p><p>y</p>' );
		} );

		it( 'model remove converter should be possible to overwrite', () => {
			editor.editing.downcastDispatcher.on( 'remove:listItem', evt => {
				evt.stop();
			}, { priority: 'highest' } );

			// Paragraph is needed to prevent autoparagraphing of empty editor.
			setModelData( model, '<paragraph>x</paragraph><listItem indent="0" type="bulleted"></listItem>' );

			model.change( writer => {
				writer.remove( modelRoot.getChild( 1 ) );
			} );

			expect( getViewData( editor.editing.view, { withoutSelection: true } ) ).to.equal( '<p>x</p><ul><li></li></ul>' );
		} );

		it( 'model change type converter should not fire if change was already consumed', () => {
			editor.editing.downcastDispatcher.on( 'attribute:type', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.item, 'attribute:type' );
			}, { priority: 'highest' } );

			setModelData( model, '<listItem indent="0" type="bulleted"></listItem>' );

			model.change( writer => {
				writer.setAttribute( 'type', 'numbered', modelRoot.getChild( 0 ) );
			} );

			expect( getViewData( editor.editing.view, { withoutSelection: true } ) ).to.equal( '<ul><li></li></ul>' );
		} );

		it( 'model change indent converter should not fire if change was already consumed', () => {
			editor.editing.downcastDispatcher.on( 'attribute:indent', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.item, 'attribute:indent' );
			}, { priority: 'highest' } );

			setModelData( model, '<listItem indent="0" type="bulleted">a</listItem><listItem indent="0" type="bulleted">b</listItem>' );

			model.change( writer => {
				writer.setAttribute( 'indent', 1, modelRoot.getChild( 1 ) );
			} );

			expect( getViewData( editor.editing.view, { withoutSelection: true } ) ).to.equal( '<ul><li>a</li><li>b</li></ul>' );
		} );

		it( 'view li converter should not fire if change was already consumed', () => {
			editor.data.upcastDispatcher.on( 'element:li', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.viewItem, { name: true } );
			}, { priority: 'highest' } );

			editor.setData( '<p></p><ul><li></li></ul>' );

			expect( getModelData( model, { withoutSelection: true } ) ).to.equal( '<paragraph></paragraph>' );
		} );

		it( 'view ul converter should not fire if change was already consumed', () => {
			editor.data.upcastDispatcher.on( 'element:ul', ( evt, data, conversionApi ) => {
				conversionApi.consumable.consume( data.viewItem, { name: true } );
			}, { priority: 'highest' } );

			editor.setData( '<p></p><ul><li></li></ul>' );

			expect( getModelData( model, { withoutSelection: true } ) ).to.equal( '<paragraph></paragraph>' );
		} );

		it( 'view converter should pass model range in data.modelRange', () => {
			editor.data.upcastDispatcher.on( 'element:ul', ( evt, data ) => {
				expect( data.modelRange ).to.be.instanceof( ModelRange );
			}, { priority: 'lowest' } );

			editor.setData( '<ul><li>Foo</li><li>Bar</li></ul>' );
		} );

		// This test tests the fix in `injectViewList` helper.
		it( 'ul and ol should not be inserted before ui element - injectViewList()', () => {
			editor.setData( '<ul><li>Foo</li><li>Bar</li></ul>' );

			const uiElement = new ViewUIElement( 'span' );

			// Append ui element at the end of first <li>.
			view.change( writer => {
				const firstChild = viewDoc.getRoot().getChild( 0 ).getChild( 0 );

				writer.insert( ViewPosition.createAt( firstChild, 'end' ), uiElement );
			} );

			expect( getViewData( editor.editing.view, { withoutSelection: true } ) )
				.to.equal( '<ul><li>Foo<span></span></li><li>Bar</li></ul>' );

			model.change( writer => {
				// Change indent of the second list item.
				writer.setAttribute( 'indent', 1, modelRoot.getChild( 1 ) );
			} );

			// Check if the new <ul> was added at correct position.
			expect( getViewData( editor.editing.view, { withoutSelection: true } ) )
				.to.equal( '<ul><li>Foo<span></span><ul><li>Bar</li></ul></li></ul>' );
		} );

		// This test tests the fix in `hoistNestedLists` helper.
		it( 'ul and ol should not be inserted before ui element - hoistNestedLists()', () => {
			editor.setData( '<ul><li>Foo</li><li>Bar<ul><li>Xxx</li><li>Yyy</li></ul></li></ul>' );

			const uiElement = new ViewUIElement( 'span' );

			// Append ui element at the end of first <li>.
			view.change( writer => {
				const firstChild = viewDoc.getRoot().getChild( 0 ).getChild( 0 );

				writer.insert( ViewPosition.createAt( firstChild, 'end' ), uiElement );
			} );

			expect( getViewData( editor.editing.view, { withoutSelection: true } ) )
				.to.equal( '<ul><li>Foo<span></span></li><li>Bar<ul><li>Xxx</li><li>Yyy</li></ul></li></ul>' );

			model.change( writer => {
				// Remove second list item. Expect that its sub-list will be moved to first list item.
				writer.remove( modelRoot.getChild( 1 ) );
			} );

			// Check if the <ul> was added at correct position.
			expect( getViewData( editor.editing.view, { withoutSelection: true } ) )
				.to.equal( '<ul><li>Foo<span></span><ul><li>Xxx</li><li>Yyy</li></ul></li></ul>' );
		} );

		describe( 'remove converter should properly handle ui elements', () => {
			let uiElement, liFoo, liBar;

			beforeEach( () => {
				editor.setData( '<ul><li>Foo</li><li>Bar</li></ul>' );
				liFoo = modelRoot.getChild( 0 );
				liBar = modelRoot.getChild( 1 );

				uiElement = new ViewUIElement( 'span' );
			} );

			it( 'ui element before <ul>', () => {
				view.change( writer => {
					// Append ui element before <ul>.
					writer.insert( ViewPosition.createAt( viewRoot ), uiElement );
				} );

				model.change( writer => {
					writer.remove( liFoo );
				} );

				expect( getViewData( editor.editing.view, { withoutSelection: true } ) )
					.to.equal( '<span></span><ul><li>Bar</li></ul>' );
			} );

			it( 'ui element before first <li>', () => {
				view.change( writer => {
					// Append ui element before <ul>.
					writer.insert( ViewPosition.createAt( viewRoot.getChild( 0 ) ), uiElement );
				} );

				model.change( writer => {
					writer.remove( liFoo );
				} );

				expect( getViewData( editor.editing.view, { withoutSelection: true } ) )
					.to.equal( '<ul><span></span><li>Bar</li></ul>' );
			} );

			it( 'ui element in the middle of list', () => {
				view.change( writer => {
					// Append ui element before <ul>.
					writer.insert( ViewPosition.createAt( viewRoot.getChild( 0 ), 'end' ), uiElement );
				} );

				model.change( writer => {
					writer.remove( liBar );
				} );

				expect( getViewData( editor.editing.view, { withoutSelection: true } ) )
					.to.equal( '<ul><li>Foo</li><span></span></ul>' );
			} );
		} );
	} );

	describe( 'schema checking and parent splitting', () => {
		beforeEach( () => {
			// Since this part of test tests only view->model conversion editing pipeline is not necessary.
			editor.editing.destroy();
		} );

		it( 'list should be not converted when modelCursor and its ancestors disallow to insert list', () => {
			model.document.createRoot( '$title', 'title' );

			model.schema.register( '$title', {
				disallow: '$block',
				allow: 'inline'
			} );

			editor.data.set( '<ul><li>foo</li></ul>', 'title' );

			expect( getModelData( model, { rootName: 'title', withoutSelection: true } ) ).to.equal( '' );
		} );

		it( 'should split parent element when one of modelCursor ancestors allows to insert list - in the middle', () => {
			editor.conversion.for( 'upcast' ).add( upcastElementToElement( { view: 'div', model: 'div' } ) );
			model.schema.register( 'div', { inheritAllFrom: '$block' } );

			editor.setData(
				'<div>' +
					'abc' +
					'<ul>' +
						'<li>foo</li>' +
					'</ul>' +
					'def' +
				'</div>'
			);

			expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
				'<div>abc</div>' +
				'<listItem indent="0" type="bulleted">foo</listItem>' +
				'<div>def</div>'
			);
		} );

		it( 'should split parent element when one of modelCursor ancestors allows to insert list - at the end', () => {
			editor.conversion.for( 'upcast' ).add( upcastElementToElement( { view: 'div', model: 'div' } ) );
			model.schema.register( 'div', { inheritAllFrom: '$block' } );

			editor.setData(
				'<div>' +
					'abc' +
					'<ul>' +
						'<li>foo</li>' +
					'</ul>' +
				'</div>'
			);

			expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
				'<div>abc</div>' +
				'<listItem indent="0" type="bulleted">foo</listItem>'
			);
		} );

		it( 'should split parent element when one of modelCursor ancestors allows to insert list - at the beginning', () => {
			editor.conversion.for( 'upcast' ).add( upcastElementToElement( { view: 'div', model: 'div' } ) );
			model.schema.register( 'div', { inheritAllFrom: '$block' } );

			editor.setData(
				'<div>' +
					'<ul>' +
					'<li>foo</li>' +
					'</ul>' +
					'def' +
				'</div>'
			);

			expect( getModelData( model, { withoutSelection: true } ) ).to.equal(
				'<listItem indent="0" type="bulleted">foo</listItem>' +
				'<div>def</div>'
			);
		} );
	} );

	function getViewPosition( root, path ) {
		let parent = root;

		while ( path.length > 1 ) {
			parent = parent.getChild( path.shift() );
		}

		return new ViewPosition( parent, path[ 0 ] );
	}

	function getViewPath( position ) {
		const path = [ position.offset ];
		let parent = position.parent;

		while ( parent.parent ) {
			path.unshift( parent.index );
			parent = parent.parent;
		}

		return path;
	}

	function testInsert( testName, input, output, testUndo = true ) {
		// Cut out inserted element that is between '[' and ']' characters.
		const selStart = input.indexOf( '[' ) + 1;
		const selEnd = input.indexOf( ']' );

		const item = input.substring( selStart, selEnd );
		const modelInput = input.substring( 0, selStart ) + input.substring( selEnd );

		const actionCallback = () => {
			model.change( writer => {
				writer.insert( parseModel( item, model.schema ), modelDoc.selection.getFirstPosition() );
			} );
		};

		_test( testName, modelInput, output, actionCallback, testUndo );
	}

	function testRemove( testName, input, output ) {
		const actionCallback = () => {
			model.change( writer => {
				writer.remove( modelDoc.selection.getFirstRange() );
			} );
		};

		_test( testName, input, output, actionCallback );
	}

	function testChangeType( testName, input, output ) {
		const actionCallback = () => {
			const element = modelDoc.selection.getFirstPosition().nodeAfter;
			const newType = element.getAttribute( 'type' ) == 'numbered' ? 'bulleted' : 'numbered';

			model.change( writer => {
				const itemsToChange = Array.from( modelDoc.selection.getSelectedBlocks() );

				for ( const item of itemsToChange ) {
					writer.setAttribute( 'type', newType, item );
				}
			} );
		};

		_test( testName, input, output, actionCallback );
	}

	function testRenameFromListItem( testName, input, output, testUndo = true ) {
		const actionCallback = () => {
			const element = modelDoc.selection.getFirstPosition().nodeAfter;

			model.change( writer => {
				writer.rename( element, 'paragraph' );
				writer.removeAttribute( 'type', element );
				writer.removeAttribute( 'indent', element );
			} );
		};

		_test( testName, input, output, actionCallback, testUndo );
	}

	function testRenameToListItem( testName, newIndent, input, output ) {
		const actionCallback = () => {
			const element = modelDoc.selection.getFirstPosition().nodeAfter;

			model.change( writer => {
				writer.setAttributes( { type: 'bulleted', indent: newIndent }, element );
				writer.rename( element, 'listItem' );
			} );
		};

		_test( testName, input, output, actionCallback );
	}

	function testChangeIndent( testName, newIndent, input, output ) {
		const actionCallback = () => {
			model.change( writer => {
				writer.setAttribute( 'indent', newIndent, modelDoc.selection.getFirstRange() );
			} );
		};

		_test( testName, input, output, actionCallback );
	}

	function testMove( testName, input, rootOffset, output, testUndo = true ) {
		const actionCallback = () => {
			const targetPosition = ModelPosition.createAt( modelRoot, rootOffset );

			model.change( writer => {
				writer.move( modelDoc.selection.getFirstRange(), targetPosition );
			} );
		};

		_test( testName, input, output, actionCallback, testUndo );
	}

	function _test( testName, input, output, actionCallback ) {
		it( testName, () => {
			setModelData( model, input );

			actionCallback();

			expect( getViewData( view, { withoutSelection: true } ) ).to.equal( output );
		} );

		it( testName + ' (undo integration)', () => {
			setModelData( model, input );

			const modelBefore = input;
			const viewBefore = getViewData( view, { withoutSelection: true } );

			actionCallback();

			const modelAfter = getModelData( model );
			const viewAfter = getViewData( view, { withoutSelection: true } );

			editor.execute( 'undo' );

			expect( getModelData( model ) ).to.equal( modelBefore );
			expect( getViewData( view, { withoutSelection: true } ) ).to.equal( viewBefore );

			editor.execute( 'redo' );

			expect( getModelData( model ) ).to.equal( modelAfter );
			expect( getViewData( view, { withoutSelection: true } ) ).to.equal( viewAfter );
		} );
	}
} );
