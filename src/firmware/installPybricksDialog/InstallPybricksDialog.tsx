// SPDX-License-Identifier: MIT
// Copyright (c) 2022-2023 The Pybricks Authors

import './installPybricksDialog.scss';
import {
    Button,
    Checkbox,
    Classes,
    Collapse,
    ControlGroup,
    DialogStep,
    FormGroup,
    Icon,
    InputGroup,
    Intent,
    MultistepDialog,
    NonIdealState,
    Popover,
    Pre,
    Spinner,
} from '@blueprintjs/core';
import { ChevronDown, ChevronRight, Error } from '@blueprintjs/icons';
import { FirmwareMetadata, HubType } from '@pybricks/firmware';
import { fileOpen } from 'browser-fs-access';
import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useDispatch } from 'react-redux';
import { useLocalStorage } from 'usehooks-ts';
import { alertsShowAlert } from '../../alerts/actions';
import {
    appName,
    legoMindstormsRegisteredTrademark,
    zipFileExtension,
    zipFileMimeType,
} from '../../app/constants';
import { Hub, hubBootloaderType } from '../../components/hubPicker';
import { HubPicker } from '../../components/hubPicker/HubPicker';
import { useHubPickerSelectedHub } from '../../components/hubPicker/hooks';
import { useSelector } from '../../reducers';
import { ensureError } from '../../utils';
import BootloaderInstructions from '../bootloaderInstructions/BootloaderInstructions';
import {
    firmwareInstallPybricksDialogAccept,
    firmwareInstallPybricksDialogCancel,
} from './actions';
import { FirmwareData, useCustomFirmware, useFirmware } from './hooks';
import { useI18n } from './i18n';
import { validateHubName } from '.';

const defaultHubNumber = '1';

const dialogBody = classNames(
    Classes.DIALOG_BODY,
    Classes.RUNNING_TEXT,
    'pb-firmware-installPybricksDialog-body',
);

/** Translates hub type from firmware metadata to local hub type. */
function getHubTypeFromMetadata(
    metadata: FirmwareMetadata | undefined,
    fallback: Hub,
): Hub {
    switch (metadata?.['device-id']) {
        case HubType.TechnicHub:
            return Hub.Technic;
        case HubType.PrimeHub:
            return Hub.Prime;
        default:
            return fallback;
    }
}

function getHubTypeNameFromMetadata(metadata: FirmwareMetadata | undefined): string {
    switch (metadata?.['device-id']) {
        case HubType.TechnicHub:
            return 'Technic Hub';
        case HubType.PrimeHub:
            return 'SPIKE Prime/MINDSTORMS Robot Inventor hub';
        default:
            return '?';
    }
}

const UnsupportedHubs: React.FunctionComponent = () => {
    const i18n = useI18n();

    return (
        <div className={Classes.RUNNING_TEXT}>
            <h4>
                {i18n.translate(
                    'selectHubPanel.notOnListButton.info.mindstorms.title',
                    { legoMindstormsRegisteredTrademark },
                )}
            </h4>
            <p>
                {i18n.translate(
                    'selectHubPanel.notOnListButton.info.mindstorms.intro',
                    {
                        appName,
                        legoMindstormsRegisteredTrademark,
                    },
                )}
            </p>
        </div>
    );
};

type SelectHubPanelProps = {
    isCustomFirmwareRequested: boolean;
    customFirmwareData: FirmwareData | undefined;
    onCustomFirmwareZip: (firmwareZip: File | undefined) => void;
};

const SelectHubPanel: React.FunctionComponent<SelectHubPanelProps> = ({
    isCustomFirmwareRequested,
    customFirmwareData,
    onCustomFirmwareZip,
}) => {
    const [isAdvancedOpen, setIsAdvancedOpen] = useLocalStorage(
        'installPybricksDialog.isAdvancedOpen',
        false,
    );
    const i18n = useI18n();
    const dispatch = useDispatch();

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            // should only be one file since multiple={false}
            acceptedFiles.forEach((f) => {
                onCustomFirmwareZip(f);
            });
        },
        [onCustomFirmwareZip],
    );

    const onClick = useCallback(async () => {
        try {
            const file = await fileOpen({
                id: 'customFirmware',
                mimeTypes: [zipFileMimeType],
                extensions: [zipFileExtension],
                // TODO: translate description
                description: 'Zip Files',
                excludeAcceptAllOption: true,
                startIn: 'downloads',
            });

            onCustomFirmwareZip(file);
        } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
                // user cancelled, nothing to do
            } else {
                dispatch(
                    alertsShowAlert('alerts', 'unexpectedError', {
                        error: ensureError(err),
                    }),
                );
            }
        }
    }, [dispatch, onCustomFirmwareZip]);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') {
                return;
            }

            e.stopPropagation();
            onClick();
        },
        [onClick],
    );

    const { getRootProps, getInputProps } = useDropzone({
        accept: { [zipFileMimeType]: [zipFileExtension] },
        multiple: false,
        // react-dropzone doesn't allow full control of File System API, so we
        // implement our own using browser-fs-access instead.
        noClick: true,
        onDrop,
    });

    return (
        <div className={dialogBody}>
            {isCustomFirmwareRequested ? (
                <>
                    <p>{i18n.translate('selectHubPanel.customFirmware.message')}</p>
                    <p>
                        {i18n.translate('selectHubPanel.customFirmware.hubType', {
                            hubTypeName: getHubTypeNameFromMetadata(
                                customFirmwareData?.metadata,
                            ),
                        })}
                    </p>
                    <p>
                        {i18n.translate(
                            'selectHubPanel.customFirmware.firmwareVersion',
                            {
                                version:
                                    customFirmwareData?.metadata['firmware-version'],
                            },
                        )}
                    </p>
                    <Button
                        onClick={() => {
                            onCustomFirmwareZip(undefined);
                        }}
                    >
                        {i18n.translate('selectHubPanel.customFirmware.clearButton')}
                    </Button>
                </>
            ) : (
                <>
                    <p>{i18n.translate('selectHubPanel.message')}</p>
                    <HubPicker />
                    <Popover
                        popoverClassName={Classes.POPOVER_CONTENT_SIZING}
                        placement="right-end"
                        content={<UnsupportedHubs />}
                        renderTarget={({ isOpen: _isOpen, ref, ...targetProps }) => (
                            <Button
                                ref={ref as React.Ref<HTMLButtonElement>}
                                {...targetProps}
                            >
                                {i18n.translate('selectHubPanel.notOnListButton.label')}
                            </Button>
                        )}
                    />
                </>
            )}
            <div className="pb-firmware-installPybricksDialog-selectHub-advanced">
                <Button
                    minimal={true}
                    small={true}
                    icon={isAdvancedOpen ? <ChevronDown /> : <ChevronRight />}
                    onClick={() => setIsAdvancedOpen((v) => !v)}
                >
                    {i18n.translate('selectHubPanel.advanced.label')}
                </Button>
                <Collapse isOpen={isAdvancedOpen}>
                    <div
                        {...getRootProps({
                            className: 'pb-dropzone-root',
                            onClick,
                            onKeyDown,
                        })}
                    >
                        <input {...getInputProps()} />
                        {i18n.translate(
                            'selectHubPanel.advanced.customFirmwareDropzone.label',
                        )}
                    </div>
                </Collapse>
            </div>
        </div>
    );
};

type AcceptLicensePanelProps = {
    licenseAccepted: boolean;
    firmwareData: FirmwareData | undefined;
    firmwareError: Error | undefined;
    isCustomFirmwareRequested: boolean;
    customFirmwareData: FirmwareData | undefined;
    customFirmwareError: Error | undefined;
    onLicenseAcceptedChanged: (accepted: boolean) => void;
};

const AcceptLicensePanel: React.FunctionComponent<AcceptLicensePanelProps> = ({
    licenseAccepted,
    firmwareData,
    firmwareError,
    isCustomFirmwareRequested,
    customFirmwareData,
    customFirmwareError,
    onLicenseAcceptedChanged,
}) => {
    const i18n = useI18n();

    const selectedFirmwareData = isCustomFirmwareRequested
        ? customFirmwareData
        : firmwareData;
    const selectedFirmwareError = isCustomFirmwareRequested
        ? customFirmwareError
        : firmwareError;

    return (
        <div className={dialogBody}>
            <div className="pb-firmware-installPybricksDialog-license-text">
                {selectedFirmwareData ? (
                    <Pre>{selectedFirmwareData.licenseText}</Pre>
                ) : (
                    <NonIdealState
                        icon={selectedFirmwareError ? <Error /> : <Spinner />}
                        description={
                            selectedFirmwareError
                                ? i18n.translate('licensePanel.licenseText.error')
                                : undefined
                        }
                    />
                )}
            </div>
            <Checkbox
                className="pb-firmware-installPybricksDialog-license-checkbox"
                label={i18n.translate('licensePanel.acceptCheckbox.label')}
                checked={licenseAccepted}
                onChange={(e) => onLicenseAcceptedChanged(e.currentTarget.checked)}
                disabled={!selectedFirmwareData}
            />
        </div>
    );
};

type SelectOptionsPanelProps = {
    hubName: string;
    metadata: FirmwareMetadata | undefined;
    onChangeHubName(hubName: string): void;
};

const ConfigureOptionsPanel: React.FunctionComponent<SelectOptionsPanelProps> = ({
    hubName,
    metadata,
    onChangeHubName,
}) => {
    const i18n = useI18n();
    const isHubNameValid = metadata ? validateHubName(hubName, metadata) : true;

    return (
        <div className={dialogBody}>
            <FormGroup
                label={i18n.translate('optionsPanel.hubName.label')}
                labelInfo={i18n.translate('optionsPanel.hubName.labelInfo')}
            >
                <ControlGroup>
                    <InputGroup
                        type="text"
                        value={hubName}
                        onChange={(e) => {
                            const value = e.currentTarget.value;
                            if (/^\d*$/.test(value) && value.length <= 3) {
                                onChangeHubName(value);
                            }
                        }}
                        onMouseOver={(e) => e.preventDefault()}
                        onMouseDown={(e) => e.stopPropagation()}
                        intent={isHubNameValid ? Intent.NONE : Intent.DANGER}
                        placeholder={defaultHubNumber}
                        rightElement={
                            isHubNameValid ? undefined : (
                                <Icon
                                    icon={<Error />}
                                    intent={Intent.DANGER}
                                    tagName="div"
                                />
                            )
                        }
                    />
                </ControlGroup>
                <div className="pb-firmware-installPybricksDialog-options-blurb">
                    <strong>{i18n.translate('optionsPanel.hubName.blurbTitle')}</strong>
                    <ol>
                        <li>{i18n.translate('optionsPanel.hubName.blurbStep1')}</li>
                        <li>{i18n.translate('optionsPanel.hubName.blurbStep2')}</li>
                        <li>{i18n.translate('optionsPanel.hubName.blurbStep3')}</li>
                    </ol>
                </div>
            </FormGroup>
        </div>
    );
};

type BootloaderModePanelProps = {
    hubType: Hub;
};

const BootloaderModePanel: React.FunctionComponent<BootloaderModePanelProps> = ({
    hubType,
}) => {
    const i18n = useI18n();

    return (
        <div className={classNames(Classes.DIALOG_BODY, Classes.RUNNING_TEXT)}>
            <BootloaderInstructions
                hubType={hubType}
                flashButtonText={i18n.translate('flashFirmwareButton.label')}
            />
        </div>
    );
};

export const InstallPybricksDialog: React.FunctionComponent = () => {
    const { isOpen } = useSelector((s) => s.firmware.installPybricksDialog);
    const inProgress = useSelector(
        (s) =>
            s.firmware.isFirmwareFlashUsbDfuInProgress ||
            s.firmware.isFirmwareRestoreOfficialDfuInProgress,
    );
    const dispatch = useDispatch();
    const [hubName, setHubName] = useState(defaultHubNumber);
    const [licenseAccepted, setLicenseAccepted] = useState(false);
    const [hubType] = useHubPickerSelectedHub();
    const { firmwareData, firmwareError } = useFirmware(hubType);
    const [customFirmwareZip, setCustomFirmwareZip] = useState<File>();
    const { isCustomFirmwareRequested, customFirmwareData, customFirmwareError } =
        useCustomFirmware(customFirmwareZip);
    const i18n = useI18n();

    const selectedFirmwareData = isCustomFirmwareRequested
        ? customFirmwareData
        : firmwareData;
    const selectedHubType = isCustomFirmwareRequested
        ? getHubTypeFromMetadata(customFirmwareData?.metadata, hubType)
        : hubType;

    const handleStepChange = useCallback(
        (newStepId: string, prevStepId: string | undefined) => {
            if (prevStepId === 'options' && newStepId === 'bootloader') {
                console.log('Selected Hub Name (from options step):', hubName);
            }
        },
        [hubName], // Add hubName to dependency array
    );

    return (
        <MultistepDialog
            initialStepIndex={0} // Start at the license step (index 1, assuming "hub" is 0)
            title={i18n.translate('title')}
            isOpen={isOpen}
            onClose={() => dispatch(firmwareInstallPybricksDialogCancel())}
            onChange={handleStepChange}
            backButtonProps={{ text: i18n.translate('backButton.label') }}
            nextButtonProps={{ text: i18n.translate('nextButton.label') }}
            finalButtonProps={{
                text: i18n.translate('flashFirmwareButton.label'),
                disabled: inProgress,
                onClick: () =>
                    dispatch(
                        firmwareInstallPybricksDialogAccept(
                            hubBootloaderType(selectedHubType),
                            selectedFirmwareData?.firmwareZip ?? new ArrayBuffer(0),
                            `Hub ${hubName || defaultHubNumber}`,
                        ),
                    ),
            }}
        >
            <DialogStep
                id="hub"
                title={i18n.translate('selectHubPanel.title')}
                panel={
                    <SelectHubPanel
                        isCustomFirmwareRequested={isCustomFirmwareRequested}
                        customFirmwareData={customFirmwareData}
                        onCustomFirmwareZip={setCustomFirmwareZip}
                    />
                }
            />
            <DialogStep
                id="license"
                title={i18n.translate('licensePanel.title')}
                panel={
                    <AcceptLicensePanel
                        licenseAccepted={licenseAccepted}
                        firmwareData={firmwareData}
                        firmwareError={firmwareError}
                        isCustomFirmwareRequested={isCustomFirmwareRequested}
                        customFirmwareData={customFirmwareData}
                        customFirmwareError={customFirmwareError}
                        onLicenseAcceptedChanged={setLicenseAccepted}
                    />
                }
                nextButtonProps={{
                    disabled: !licenseAccepted,
                    text: i18n.translate('nextButton.label'),
                }}
            />
            <DialogStep
                id="options"
                title={i18n.translate('optionsPanel.title')}
                panel={
                    <ConfigureOptionsPanel
                        hubName={hubName}
                        metadata={
                            isCustomFirmwareRequested
                                ? customFirmwareData?.metadata
                                : firmwareData?.metadata
                        }
                        onChangeHubName={setHubName}
                    />
                }
                // Removed custom nextButtonProps from here to restore default navigation
            />
            <DialogStep
                id="bootloader"
                title={i18n.translate('bootloaderPanel.title')}
                panel={<BootloaderModePanel hubType={selectedHubType} />}
            />
        </MultistepDialog>
    );
};
