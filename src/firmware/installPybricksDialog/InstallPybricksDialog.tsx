// SPDX-License-Identifier: MIT
// Copyright (c) 2022-2023 The Pybricks Authors

import './installPybricksDialog.scss';
import {
    Button,
    Checkbox,
    Classes,
    Collapse,
    DialogStep,
    FormGroup,
    Icon,
    MultistepDialog,
    NonIdealState,
    Popover,
    Pre,
    Spinner,
} from '@blueprintjs/core';
import { ChevronDown, ChevronRight, Error, Heart } from '@blueprintjs/icons';
import { FirmwareMetadata, HubType } from '@pybricks/firmware';
import { fileOpen } from 'browser-fs-access';
import classNames from 'classnames';
import React, { useCallback, useState } from 'react';
import { VisuallyHidden } from 'react-aria';
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

const AppColors = {
    white: { h: 0, s: 0, v: 100 },
    red: { h: 0, s: 90, v: 100 },
    orang: { h: 30, s: 90, v: 100 },
    yellw: { h: 60, s: 90, v: 100 },
    green: { h: 130, s: 90, v: 100 },
    blue: { h: 240, s: 90, v: 100 },
    pink: { h: 300, s: 90, v: 100 }, // Using "pink" as the key for Magenta
} as const;

type AppColorName = keyof typeof AppColors;

const ColorOptionsArray: AppColorName[] = Object.keys(AppColors) as AppColorName[];

// HSV to HSL conversion function (for CSS)
function hsvToHsl(
    h: number,
    s: number,
    v: number,
): { h: number; s: number; l: number } {
    s /= 100;
    v /= 100;
    const l = v * (1 - s / 2);
    let newS = 0;
    if (l > 0 && l < 1) {
        newS = (v - l) / Math.min(l, 1 - l);
    }
    return { h, s: newS * 100, l: l * 100 };
}

const getColorDisplayName = (color: AppColorName): string => {
    return color.charAt(0).toUpperCase() + color.slice(1);
};

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
        case HubType.MoveHub:
            return Hub.Move;
        case HubType.CityHub:
            return Hub.City;
        case HubType.TechnicHub:
            return Hub.Technic;
        case HubType.PrimeHub:
            return Hub.Prime;
        case HubType.EssentialHub:
            return Hub.Essential;
        default:
            return fallback;
    }
}

function getHubTypeNameFromMetadata(metadata: FirmwareMetadata | undefined): string {
    switch (metadata?.['device-id']) {
        case HubType.MoveHub:
            return 'BOOST Move Hub';
        case HubType.CityHub:
            return 'City Hub';
        case HubType.TechnicHub:
            return 'Technic Hub';
        case HubType.PrimeHub:
            return 'SPIKE Prime/MINDSTORMS Robot Inventor hub';
        case HubType.EssentialHub:
            return 'SPIKE Essential hub';
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
            <p>
                {i18n.translate(
                    'selectHubPanel.notOnListButton.info.mindstorms.help.message',
                    {
                        sponsor: (
                            <>
                                <VisuallyHidden elementType="span">
                                    {i18n.translate(
                                        'selectHubPanel.notOnListButton.info.mindstorms.help.sponsor',
                                    )}
                                </VisuallyHidden>
                                <Icon icon={<Heart />} />
                            </>
                        ),
                    },
                )}
            </p>
            <ul>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.mindstorms.rcx',
                    )}
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.mindstorms.nxt',
                    )}
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.mindstorms.ev3',
                    )}
                </li>
            </ul>
            <h4>
                {i18n.translate('selectHubPanel.notOnListButton.info.poweredUp.title')}
            </h4>
            <p>
                {i18n.translate('selectHubPanel.notOnListButton.info.poweredUp.intro')}
            </p>
            <ul>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.poweredUp.wedo2',
                    )}
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.poweredUp.duploTrain',
                    )}
                </li>
                <li>
                    {i18n.translate(
                        'selectHubPanel.notOnListButton.info.poweredUp.mario',
                    )}
                </li>
            </ul>
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
    selectedColorPair: [AppColorName, AppColorName] | undefined;
    onChangeColorPair: (pair: [AppColorName, AppColorName]) => void;
};

const ConfigureOptionsPanel: React.FunctionComponent<SelectOptionsPanelProps> = ({
    hubName: _hubName,
    metadata: _metadata,
    onChangeHubName,
    selectedColorPair,
    onChangeColorPair,
}) => {
    const i18n = useI18n();

    const handleColorSelect = (color1: AppColorName, color2: AppColorName) => {
        onChangeColorPair([color1, color2]);
        const newHubName = `hub ${color1} ${color2}`;
        onChangeHubName(newHubName);
    };

    return (
        <div className={dialogBody}>
            <FormGroup
                label={i18n.translate('optionsPanel.colorPair.label')}
                className="pb-color-picker-form-group" // Add a custom class
            >
                <div className="pb-color-picker-container">
                    {ColorOptionsArray.map((color1, index1) => (
                        <div key={`col-${color1}`} className="pb-color-picker-column">
                            {/* Inner loop starts from color1 to ensure unique pairs (color1, color2) where color2 >= color1 */}
                            {ColorOptionsArray.slice(index1).map((color2) => {
                                // const actualRowColor = color2; // Simpler name

                                const isSelected =
                                    selectedColorPair?.[0] === color1 &&
                                    selectedColorPair?.[1] === color2;

                                const c1Hsv = AppColors[color1];
                                const c2Hsv = AppColors[color2];
                                const c1Hsl = hsvToHsl(c1Hsv.h, c1Hsv.s, c1Hsv.v);
                                const c2Hsl = hsvToHsl(c2Hsv.h, c2Hsv.s, c2Hsv.v);

                                return (
                                    <Button
                                        key={`${color1}-${color2}`}
                                        className={classNames('pb-color-pair-button', {
                                            'pb-color-pair-selected': isSelected,
                                        })}
                                        onClick={() =>
                                            handleColorSelect(color1, color2)
                                        }
                                        aria-label={`Select ${getColorDisplayName(
                                            color1,
                                        )} and ${getColorDisplayName(color2)}`}
                                    >
                                        <div className="pb-swatch-pair-wrapper">
                                            <div
                                                className="pb-color-swatch"
                                                style={{
                                                    backgroundColor: `hsl(${c1Hsl.h}, ${c1Hsl.s}%, ${c1Hsl.l}%)`,
                                                }}
                                                title={getColorDisplayName(color1)}
                                            />
                                            <div
                                                className="pb-color-swatch"
                                                style={{
                                                    backgroundColor: `hsl(${c2Hsl.h}, ${c2Hsl.s}%, ${c2Hsl.l}%)`,
                                                }}
                                                title={getColorDisplayName(color2)}
                                            />
                                        </div>
                                    </Button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </FormGroup>
            {/* You can uncomment this InputGroup if you need to see the generated hub name for debugging */}
            {/* <InputGroup
                readOnly
                value={hubName}
                style={{ marginTop: '10px' }}
                aria-label="Generated Hub Name"
            /> */}
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
    // Initialize with the first color pair (e.g., white/white)
    const defaultColor1 = ColorOptionsArray[0];
    const defaultColor2 = ColorOptionsArray[0];
    const initialHubName = `hub ${defaultColor1} ${defaultColor2}`;
    const [hubName, setHubName] = useState(initialHubName);
    const [selectedColorPair, setSelectedColorPair] = useState<
        [AppColorName, AppColorName] | undefined
    >([defaultColor1, defaultColor2]);
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
            title={i18n.translate('title')}
            isOpen={isOpen}
            onClose={() => dispatch(firmwareInstallPybricksDialogCancel())}
            onChange={handleStepChange} // Add the onChange handler here
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
                            hubName,
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
                        selectedColorPair={selectedColorPair}
                        onChangeColorPair={setSelectedColorPair}
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
