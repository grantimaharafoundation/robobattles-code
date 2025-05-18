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
//import { useHubPickerSelectedHub } from '../../components/hubPicker/hooks';
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
    orange: { h: 30, s: 90, v: 100 },
    yellow: { h: 60, s: 90, v: 100 },
    green: { h: 130, s: 90, v: 100 },
    blue: { h: 240, s: 90, v: 100 },
    pink: { h: 300, s: 90, v: 100 }, // Using "pink" as the key for Magenta
} as const;

type AppColorName = keyof typeof AppColors;

const ColorOptionsArray: AppColorName[] = Object.keys(AppColors) as AppColorName[];

// HSV to HSL conversion function (for CSS)
function hsvToHsl(
    h_in: number,
    s_in: number,
    v_in: number,
): { h: number; s: number; l: number } {
    const h = Number(h_in);
    const s_norm = Number(s_in) / 100; // s_in is 0-100, s_norm is 0-1
    const v_norm = Number(v_in) / 100; // v_in is 0-100, v_norm is 0-1

    let l_norm: number; // Lightness, 0-1
    let s_hsl_norm: number; // Saturation for HSL, 0-1

    if (s_norm === 0) {
        // Achromatic case (gray, white, black)
        l_norm = v_norm;
        s_hsl_norm = 0;
    } else {
        // Chromatic case
        l_norm = v_norm * (1 - s_norm / 2);
        if (l_norm === 0 || l_norm === 1) {
            // Black or white due to extreme lightness/darkness with some saturation
            s_hsl_norm = 0;
        } else {
            s_hsl_norm = (v_norm - l_norm) / Math.min(l_norm, 1 - l_norm);
        }
    }

    return {
        h: h,
        s: s_hsl_norm * 100, // Convert back to 0-100
        l: l_norm * 100, // Convert back to 0-100
    };
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
    selectedColor1: AppColorName | undefined;
    onChangeColor1: (color: AppColorName) => void;
    selectedColor2: AppColorName | undefined;
    onChangeColor2: (color: AppColorName) => void;
};

const ConfigureOptionsPanel: React.FunctionComponent<SelectOptionsPanelProps> = ({
    hubName: _hubName,
    metadata: _metadata,
    onChangeHubName,
    selectedColor1,
    onChangeColor1,
    selectedColor2,
    onChangeColor2,
}) => {
    const i18n = useI18n();

    const handleColor1Select = (color: AppColorName) => {
        onChangeColor1(color);
        const newHubName = `hub ${color} ${selectedColor2 ?? ColorOptionsArray[0]}`;
        onChangeHubName(newHubName);
    };

    const handleColor2Select = (color: AppColorName) => {
        onChangeColor2(color);
        const newHubName = `hub ${selectedColor1 ?? ColorOptionsArray[0]} ${color}`;
        onChangeHubName(newHubName);
    };

    return (
        <div className={dialogBody}>
            <p className="pb-select-hub-light-color-label">
                {i18n.translate('optionsPanel.selectHubLightColor.label')}
            </p>
            <FormGroup
                label={i18n.translate('optionsPanel.color1.label')}
                className="pb-color-picker-form-group pb-color-picker-label-normal"
            >
                <div className="pb-color-picker-row">
                    {ColorOptionsArray.map((color) => {
                        const isSelected = selectedColor1 === color;
                        const colorHsv = AppColors[color];
                        const colorHsl = hsvToHsl(colorHsv.h, colorHsv.s, colorHsv.v);
                        return (
                            <Button
                                key={`row1-${color}`}
                                className={classNames('pb-color-button', {
                                    'pb-color-selected': isSelected,
                                })}
                                onClick={() => handleColor1Select(color)}
                                aria-label={`Select ${getColorDisplayName(
                                    color,
                                )} for Color 1`}
                                minimal={true}
                                text=""
                                style={{
                                    backgroundColor: `hsl(${colorHsl.h}, ${colorHsl.s}%, ${colorHsl.l}%)`,
                                }}
                                title={getColorDisplayName(color)}
                            />
                        );
                    })}
                </div>
            </FormGroup>
            <FormGroup
                label={i18n.translate('optionsPanel.color2.label')}
                className="pb-color-picker-form-group pb-color-picker-label-normal"
            >
                <div className="pb-color-picker-row">
                    {ColorOptionsArray.map((color) => {
                        const isSelected = selectedColor2 === color;
                        const colorHsv = AppColors[color];
                        const colorHsl = hsvToHsl(colorHsv.h, colorHsv.s, colorHsv.v);
                        return (
                            <Button
                                key={`row2-${color}`}
                                className={classNames('pb-color-button', {
                                    'pb-color-selected': isSelected,
                                })}
                                onClick={() => handleColor2Select(color)}
                                aria-label={`Select ${getColorDisplayName(
                                    color,
                                )} for Color 2`}
                                minimal={true}
                                text=""
                                style={{
                                    backgroundColor: `hsl(${colorHsl.h}, ${colorHsl.s}%, ${colorHsl.l}%)`,
                                }}
                                title={getColorDisplayName(color)}
                            />
                        );
                    })}
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
    const [selectedColor1, setSelectedColor1] = useState<AppColorName | undefined>(
        defaultColor1,
    );
    const [selectedColor2, setSelectedColor2] = useState<AppColorName | undefined>(
        defaultColor2,
    );
    const [licenseAccepted, setLicenseAccepted] = useState(false);
    // Default to Technic Hub and manage hubType state locally
    const [hubType] = useState<Hub>(Hub.Technic);
    // The useHubPickerSelectedHub hook is no longer the primary source for hubType
    // const [pickerHubType] = useHubPickerSelectedHub(); // Keep if SelectHubPanel is conditionally rendered

    // Firmware loading will be adjusted in useFirmware hook later.
    // For now, ensure it's called with the defaulted hubType.
    const { firmwareData, firmwareError } = useFirmware(hubType);

    // Custom firmware logic is kept but will be mostly unused in the new default flow.
    const [customFirmwareZip, setCustomFirmwareZip] = useState<File>();
    const { isCustomFirmwareRequested, customFirmwareData, customFirmwareError } =
        useCustomFirmware(customFirmwareZip);
    const i18n = useI18n();

    // selectedFirmwareData and selectedHubType will primarily rely on the non-custom flow
    const selectedFirmwareData = isCustomFirmwareRequested
        ? customFirmwareData
        : firmwareData;
    // selectedHubType should now consistently be Hub.Technic unless custom firmware overrides it
    const selectedHubType = isCustomFirmwareRequested
        ? getHubTypeFromMetadata(customFirmwareData?.metadata, hubType) // Fallback to our default hubType
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
                        selectedColor1={selectedColor1}
                        onChangeColor1={setSelectedColor1}
                        selectedColor2={selectedColor2}
                        onChangeColor2={setSelectedColor2}
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
