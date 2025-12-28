import React, { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';
import type { CallBackProps, Step } from 'react-joyride';
import { supabase } from '../lib/supabase';

interface TourGuideProps {
    run: boolean;
    onFinish: () => void;
    userId: string;
    steps: Step[];
    saveOnComplete?: boolean;
}

export const TourGuide: React.FC<TourGuideProps> = ({ run, onFinish, userId, steps, saveOnComplete = false }) => {
    const [runTour, setRunTour] = useState(false);

    useEffect(() => {
        setRunTour(run);
    }, [run]);

    const handleJoyrideCallback = async (data: CallBackProps) => {
        const { status } = data;
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRunTour(false);

            if (saveOnComplete) {
                // Update profile only if this is the final part of the tour
                try {
                    await supabase
                        .from('profiles')
                        .update({ onboarding_completed: true })
                        .eq('id', userId);
                } catch (error) {
                    console.error("Error saving onboarding status:", error);
                }
            }

            onFinish();
        }
    };

    return (
        <Joyride
            callback={handleJoyrideCallback}
            continuous
            hideCloseButton
            run={runTour}
            scrollToFirstStep
            showProgress
            showSkipButton
            steps={steps}
            styles={{
                options: {
                    zIndex: 10000,
                    primaryColor: '#3b82f6', // blue-500
                    backgroundColor: '#ffffff',
                    arrowColor: '#ffffff',
                    textColor: '#1e293b',
                    overlayColor: 'rgba(15, 23, 42, 0.6)', // slate-900 with opacity
                },
                buttonNext: {
                    backgroundColor: '#3b82f6',
                    fontSize: '14px',
                    fontWeight: 700,
                    padding: '10px 20px',
                    borderRadius: '12px'
                },
                buttonBack: {
                    color: '#64748b',
                    marginRight: 10
                },
                buttonSkip: {
                    color: '#94a3b8',
                },
                tooltip: {
                    borderRadius: '24px',
                    padding: '16px'
                },
                tooltipContainer: {
                    textAlign: 'left'
                }
            }}
            locale={{
                back: 'Voltar',
                close: 'Fechar',
                last: 'Terminar',
                next: 'Seguinte',
                skip: 'Saltar'
            }}
        />
    );
};
