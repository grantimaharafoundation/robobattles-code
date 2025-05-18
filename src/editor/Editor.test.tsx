// SPDX-License-Identifier: MIT
// Copyright (c) 2021-2023 The Pybricks Authors

import { Classes } from '@blueprintjs/core';
import { act, cleanup, waitFor } from '@testing-library/react';
import * as monaco from 'monaco-editor';
import React from 'react';
import { testRender, uuid } from '../../test';
import { FileMetadata } from '../fileStorage';
import { useFileStorageMetadata, useFileStoragePath } from '../fileStorage/hooks';
import { defined } from '../utils';
import Editor from './Editor';
import { editorActivateFile, editorCloseFile } from './actions';

// not entirely clear why but this is needed since monaco-editor@0.35.0
// has something to do with @jest/fake-timers replacing window.performance
// https://jestjs.io/docs/timer-mocks#selective-faking
window.performance.mark = jest.fn();

const testFile: FileMetadata = {
    uuid: uuid(0),
    path: 'test.file',
    sha256: '',
    viewState: null,
};
jest.setTimeout(1000000);
afterEach(() => {
    cleanup();
    jest.resetAllMocks();
    localStorage.clear();
    sessionStorage.clear();
});

describe('Editor', () => {
    describe('tabs', () => {
        it('should dispatch activate action when tab is clicked', async () => {
            jest.mocked(useFileStorageMetadata).mockReturnValue([testFile]);
            jest.mocked(useFileStoragePath).mockReturnValue(testFile.path);

            const [user, editor, dispatch] = testRender(<Editor />, {
                editor: { openFileUuids: [testFile.uuid] },
            });

            await act(() => user.click(editor.getByRole('tab', { name: 'test.file' })));

            expect(dispatch).toHaveBeenCalledWith(editorActivateFile(testFile.uuid));
        });

        it.each(['{Enter}', '{Space}'])(
            'should dispatch activate action when %s key is pressed',
            async (key) => {
                jest.mocked(useFileStorageMetadata).mockReturnValue([testFile]);
                jest.mocked(useFileStoragePath).mockReturnValue(testFile.path);

                const [user, editor, dispatch] = testRender(<Editor />, {
                    editor: { openFileUuids: [testFile.uuid] },
                });

                await act(() =>
                    user.type(editor.getByRole('tab', { name: 'test.file' }), key),
                );

                expect(dispatch).toHaveBeenCalledWith(
                    editorActivateFile(testFile.uuid),
                );
            },
        );

        it('should dispatch close action when close button is clicked', async () => {
            jest.mocked(useFileStorageMetadata).mockReturnValue([testFile]);
            jest.mocked(useFileStoragePath).mockReturnValue(testFile.path);

            const [user, editor, dispatch] = testRender(<Editor />, {
                editor: { openFileUuids: [testFile.uuid] },
            });

            await act(() =>
                user.click(editor.getByRole('button', { name: 'Close test.file' })),
            );

            expect(dispatch).toHaveBeenCalledWith(editorCloseFile(testFile.uuid));
        });

        it('should dispatch close action when delete button is pressed', async () => {
            jest.mocked(useFileStorageMetadata).mockReturnValue([testFile]);
            jest.mocked(useFileStoragePath).mockReturnValue(testFile.path);

            const [user, editor, dispatch] = testRender(<Editor />, {
                editor: { openFileUuids: [testFile.uuid] },
            });

            await act(() =>
                user.type(editor.getByRole('tab', { name: 'test.file' }), '{Delete}'),
            );

            expect(dispatch).toHaveBeenCalledWith(editorCloseFile(testFile.uuid));
        });

        it('should dispatch close action when tab is middle clicked', async () => {
            jest.mocked(useFileStorageMetadata).mockReturnValue([testFile]);
            jest.mocked(useFileStoragePath).mockReturnValue(testFile.path);

            const [user, editor, dispatch] = testRender(<Editor />, {
                editor: { openFileUuids: [testFile.uuid] },
            });

            await act(() =>
                user.pointer({
                    keys: '[MouseMiddle]',
                    target: editor.getByRole('tab', { name: 'test.file' }),
                }),
            );

            expect(dispatch).toHaveBeenCalledWith(editorCloseFile(testFile.uuid));
        });
    });
});
