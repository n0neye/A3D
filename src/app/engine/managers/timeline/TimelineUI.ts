import { TimelineManager } from './TimelineManager';
import { Track } from './Track';

interface ButtonConfig {
    text: string;
    position: [number, number];
    onClick: () => void;
    color?: string;
    hoverColor?: string;
}

export class TimelineUI {
    private manager: TimelineManager;
    private debugUI: HTMLElement | null = null;

    // Add UI configuration
    private theme = {
        // Layout
        timelineStart: 150,
        trackHeight: 30,
        headerHeight: 30,
        keyframeRadius: 6,

        // Colors
        activeTrackColor: '#3B3B3B33',
        inactiveTrackColor: '#00000000',
        activeKeyframeColor: '#ffcc00',
        inactiveKeyframeColor: '#aaaaaa',
        activeKeyframeHoverColor: '#ffdd33',
        inactiveKeyframeHoverColor: '#cccccc',
        playheadColor: '#ffffff',
        textColor: '#cccccc',
        activeTextColor: '#ffffff',
        timeTickColor: '#666666',

        // Buttons
        buttonWidth: 40,
        buttonHeight: 20,
        buttonRadius: 5,
        buttonColor: '#444444',
        buttonHoverColor: '#555555',
        playButtonColor: '#55aa55',
        pauseButtonColor: '#cc5555',
        keyframeButtonColor: '#6666aa'
    };

    // Paper.js elements
    private canvas: HTMLCanvasElement | null = null;
    private timelineScope: paper.PaperScope | null = null;
    private timelinePath: paper.Path | null = null;
    private playhead: paper.Group | null = null;
    private keyframeGroups: paper.Group[] = [];
    private trackGroups: paper.Group[] = [];
    private timeLabels: paper.PointText[] = [];
    private isDraggingPlayhead = false;
    private isDraggingKeyframe = false;
    private draggedKeyframeData: {
        track: Track<any>,
        keyframe: Keyframe,
        item: paper.Item,
        originalTime: number
    } | null = null;

    constructor(manager: TimelineManager) {
        this.manager = manager;
        this.createDebugUI();

        // Subscribe to manager events
        this.manager.observers.subscribe('timelineUpdated', ({ time }) => {
            this.updatePlayheadPosition();
        });

        this.manager.observers.subscribe('playbackStateChanged', ({ isPlaying }) => {
            this.updatePaperPlayButton();
        });

        this.manager.observers.subscribe('keyframeAdded', () => {
            this.updatePaperTimeline();
        });

        this.manager.observers.subscribe('trackAdded', () => {
            this.updatePaperTimeline();
        });

        this.manager.observers.subscribe('activeTrackChanged', () => {
            this.updatePaperTimeline();
        });
    }

    /**
     * Toggle debug UI visibility
     */
    public toggleUI(visible?: boolean): void {
        if (!this.debugUI) return;

        if (visible === undefined) {
            visible = this.debugUI.style.display === 'none';
        }

        this.debugUI.style.display = visible ? 'block' : 'none';
    }

    /**
     * Update the playhead position in the Paper.js timeline
     */
    private updatePlayheadPosition(): void {
        if (!this.timelineScope || !this.playhead) return;

        // Calculate position based on time
        const timelineWidth = this.timelineScope.view.size.width - this.theme.timelineStart; // Adjust for track names
        const playheadX = this.theme.timelineStart + (this.manager.getPosition() / this.manager.getDuration()) * timelineWidth;

        // Update playhead position
        this.playhead.position.x = playheadX;

        // Update current time text
        if ((this.timelineScope.project.activeLayer.children as any)['currentTimeText']) {
            (this.timelineScope.project.activeLayer.children as any)['currentTimeText'].content =
                `Time: ${this.manager.getPosition().toFixed(2)}s`;
        }

        (this.timelineScope.view as any).draw();
    }

    /**
     * Initialize Paper.js timeline
     */
    private async initializePaperTimeline(container: HTMLElement): Promise<void> {
        if (typeof window !== 'undefined') {
            // Only import paper.js on the client side
            const paper = await import('paper/dist/paper-core');

            // Create canvas
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'timeline-canvas';
            this.canvas.width = 800;
            this.canvas.height = 100;
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100px';
            this.canvas.style.marginTop = '10px';
            container.appendChild(this.canvas);

            // Initialize Paper.js
            this.timelineScope = new paper.PaperScope();
            this.timelineScope.setup(this.canvas);

            // Set up event handlers
            this.timelineScope.view.onMouseDown = this.onPaperMouseDown.bind(this);
            this.timelineScope.view.onMouseDrag = this.onPaperMouseDrag.bind(this);
            this.timelineScope.view.onMouseUp = this.onPaperMouseUp.bind(this);

            // Draw initial timeline
            this.updatePaperTimeline();
        }
    }

    /**
     * Mouse down handler for Paper.js timeline
     */
    private onPaperMouseDown(event: paper.MouseEvent): void {
        if (!this.timelineScope) return;

        // Check for keyframe hits FIRST (highest priority)
        const tracks = this.manager.getTracks();
        for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
            const track = tracks[trackIndex];
            const keyframes = track.getKeyframes();

            for (let keyframeIndex = 0; keyframeIndex < keyframes.length; keyframeIndex++) {
                const keyframeGroup = this.findKeyframeItem(trackIndex, keyframeIndex);

                if (keyframeGroup && keyframeGroup.hitTest(event.point)) {
                    this.isDraggingKeyframe = true;
                    this.isDraggingPlayhead = false; // Ensure playhead dragging is off
                    this.draggedKeyframeData = {
                        track,
                        keyframe: keyframes[keyframeIndex],
                        item: keyframeGroup,
                        originalTime: keyframes[keyframeIndex].time
                    };
                    return; // Exit immediately once we find a hit
                }
            }
        }

        // Then check if clicking on playhead
        if (this.playhead && this.playhead.hitTest(event.point)) {
            this.isDraggingPlayhead = true;
            this.isDraggingKeyframe = false; // Ensure keyframe dragging is off
            return;
        }

        // Finally check if clicking on timeline area (for direct positioning)
        const timelineStart = this.theme.timelineStart;
        const timelineWidth = this.timelineScope.view.size.width - timelineStart;

        if (event.point.x >= timelineStart &&
            event.point.y >= this.theme.headerHeight &&
            event.point.y <= this.theme.headerHeight + (tracks.length * this.theme.trackHeight)) {

            // Calculate time from position
            const timelinePosition = (event.point.x - timelineStart) / timelineWidth;
            const newTime = timelinePosition * this.manager.getDuration();

            // Set timeline position
            this.manager.setPosition(newTime);

            // Start dragging playhead
            this.isDraggingPlayhead = true;
            this.isDraggingKeyframe = false; // Ensure keyframe dragging is off
        }
    }

    /**
     * Find a keyframe item by track and keyframe indices
     */
    private findKeyframeItem(trackIndex: number, keyframeIndex: number): paper.Item | null {
        if (!this.timelineScope) return null;

        // Search through all items in the active layer
        for (let i = 0; i < this.timelineScope.project.activeLayer.children.length; i++) {
            const item = this.timelineScope.project.activeLayer.children[i];

            // Check if this is a keyframe group with matching data
            if (item.data &&
                item.data.isKeyframe &&
                item.data.trackIndex === trackIndex &&
                item.data.keyframeIndex === keyframeIndex) {
                return item;
            }
        }

        return null;
    }

    /**
     * Mouse drag handler for Paper.js timeline
     */
    private onPaperMouseDrag(event: paper.MouseEvent): void {
        if (!this.timelineScope) return;

        // Handle dragging playhead
        if (this.isDraggingPlayhead) {
            const timelineStart = this.theme.timelineStart;
            const timelineWidth = this.timelineScope.view.size.width - timelineStart;

            // Constrain to timeline bounds
            const x = Math.max(timelineStart, Math.min(timelineStart + timelineWidth, event.point.x));

            // Calculate time from position
            const timelinePosition = (x - timelineStart) / timelineWidth;
            const newTime = timelinePosition * this.manager.getDuration();

            // Set timeline position
            this.manager.setPosition(newTime);
            return;
        }

        // Handle dragging keyframe
        if (this.isDraggingKeyframe && this.draggedKeyframeData) {
            const timelineStart = this.theme.timelineStart;
            const timelineWidth = this.timelineScope.view.size.width - timelineStart;

            // Constrain to timeline bounds
            const x = Math.max(timelineStart, Math.min(timelineStart + timelineWidth, event.point.x));

            // Calculate time from position
            const timelinePosition = (x - timelineStart) / timelineWidth;
            const newTime = Math.max(0, Math.min(this.manager.getDuration(), timelinePosition * this.manager.getDuration()));

            // Move the keyframe visually
            this.draggedKeyframeData.item.position.x = x;

            // Update time display
            if ((this.timelineScope.project.activeLayer.children as any)['currentTimeText']) {
                (this.timelineScope.project.activeLayer.children as any)['currentTimeText'].content =
                    `Keyframe: ${newTime.toFixed(2)}s`;
            }

            (this.timelineScope.view as any).draw();
        }
    }

    /**
     * Mouse up handler for Paper.js timeline
     */
    private onPaperMouseUp(event: paper.MouseEvent): void {

        // Handle end of playhead drag
        if (this.isDraggingPlayhead) {
            this.isDraggingPlayhead = false;
        }

        // Handle end of keyframe drag
        if (this.isDraggingKeyframe && this.draggedKeyframeData && this.timelineScope) {
            const timelineStart = this.theme.timelineStart;
            const timelineWidth = this.timelineScope.view.size.width - timelineStart;

            // Constrain to timeline bounds
            const x = Math.max(timelineStart, Math.min(timelineStart + timelineWidth, event.point.x));

            // Calculate time from position
            const timelinePosition = (x - timelineStart) / timelineWidth;
            const newTime = Math.max(0, Math.min(this.manager.getDuration(), timelinePosition * this.manager.getDuration()));

            // Remove old keyframe and add new one at the updated time
            this.draggedKeyframeData.track.updateKeyframeTime(this.draggedKeyframeData.keyframe, newTime);

            // Reset dragging state
            this.isDraggingKeyframe = false;
            this.draggedKeyframeData = null;

            // Update the timeline visualization
            this.updatePaperTimeline();

            // Update time display
            if ((this.timelineScope.project.activeLayer.children as any)['currentTimeText']) {
                (this.timelineScope.project.activeLayer.children as any)['currentTimeText'].content =
                    `Time: ${this.manager.getPosition().toFixed(2)}s`;
            }
        }
    }

    /**
     * Update the Paper.js timeline visualization 
     */
    private updatePaperTimeline(): void {
        if (!this.timelineScope) return;

        // Clear existing elements
        this.timelineScope.project.activeLayer.removeChildren();
        this.keyframeGroups = [];
        this.trackGroups = [];

        const width = this.timelineScope.view.size.width;
        const height = this.timelineScope.view.size.height;
        const timelineStartX = this.theme.timelineStart;
        const tracks = this.manager.getTracks();
        const activeTrackIndex = tracks.indexOf(this.manager.getActiveTrack()!);

        // Timeline container
        const timelineBackground = new this.timelineScope.Path.Rectangle({
            point: [timelineStartX, this.theme.headerHeight],
            size: [width - timelineStartX, tracks.length * this.theme.trackHeight],
            fillColor: new this.timelineScope.Color(0.25, 0.25, 0.25)
        });

        // Time markings
        for (let i = 0; i <= this.manager.getDuration(); i++) {
            const x = timelineStartX + (i / this.manager.getDuration()) * (width - timelineStartX);

            // Time tick
            const timeTick = new this.timelineScope.Path.Line({
                from: [x, this.theme.headerHeight],
                to: [x, this.theme.headerHeight + tracks.length * this.theme.trackHeight],
                strokeColor: new this.timelineScope.Color(0.4, 0.4, 0.4),
                strokeWidth: i % 1 === 0 ? 1 : 0.5
            });

            // Time label
            if (i % 1 === 0) {
                const timeLabel = new this.timelineScope.PointText({
                    point: [x, this.theme.headerHeight - 5],
                    content: i + 's',
                    fillColor: 'white',
                    fontSize: 10,
                    justification: 'center'
                });
                this.timeLabels.push(timeLabel);
            }
        }

        // Track rows
        tracks.forEach((track, index) => {
            const y = this.theme.headerHeight + index * this.theme.trackHeight;
            const trackGroup = new this.timelineScope!.Group();

            // Track row background (highlight active track)
            const isActive = index === activeTrackIndex;
            const trackRow = new this.timelineScope!.Path.Rectangle({
                point: [0, y],
                size: [width, this.theme.trackHeight],
                fillColor: isActive
                    ? new this.timelineScope!.Color(this.theme.activeTrackColor)
                    : new this.timelineScope!.Color(this.theme.inactiveTrackColor)
            });
            trackGroup.addChild(trackRow);

            // Track name
            const trackName = new this.timelineScope!.PointText({
                point: [10, y + 20],
                content: track.getName(),
                fillColor: isActive ? '#ffcc00' : 'white',
                fontSize: 12
            });
            trackGroup.addChild(trackName);

            // Track separator line
            const separator = new this.timelineScope!.Path.Line({
                from: [0, y + this.theme.trackHeight],
                to: [width, y + this.theme.trackHeight],
                strokeColor: new this.timelineScope!.Color(0.3, 0.3, 0.3)
            });
            trackGroup.addChild(separator);

            // Make track clickable to select
            trackRow.onClick = () => {
                this.manager.setActiveTrack(index);
            };

            this.trackGroups.push(trackGroup);

            // Draw keyframes for this track
            const keyframes = track.getKeyframes();
            keyframes.forEach((keyframe, keyframeIndex) => {
                const keyframeGroup = new this.timelineScope!.Group();
                const keyframeX = timelineStartX + (keyframe.time / this.manager.getDuration()) * (width - timelineStartX);

                // Keyframe diamond
                const keyframeDiamond = new this.timelineScope!.Path.RegularPolygon({
                    center: [keyframeX, y + 15],
                    sides: 4,
                    radius: 6,
                    fillColor: isActive ? '#ffcc00' : '#aaaaaa',
                    strokeColor: 'white',
                    strokeWidth: 1,
                    rotation: 45
                });

                keyframeGroup.addChild(keyframeDiamond);

                // Store keyframe data for dragging
                keyframeGroup.data = {
                    isKeyframe: true,
                    trackIndex: index,
                    keyframeIndex: keyframeIndex
                };

                // Add hover effects and cursor 
                keyframeGroup.onMouseEnter = () => {
                    document.body.style.cursor = 'pointer';
                    keyframeDiamond.scale(1.2); // Slightly enlarge on hover
                    keyframeDiamond.fillColor = new this.timelineScope!.Color(isActive ? '#ffdd33' : '#cccccc');
                    (this.timelineScope!.view as any).draw();
                };

                keyframeGroup.onMouseLeave = () => {
                    document.body.style.cursor = 'default';
                    keyframeDiamond.scale(1 / 1.2); // Return to normal size
                    keyframeDiamond.fillColor = new this.timelineScope!.Color(isActive ? '#ffcc00' : '#aaaaaa');
                    (this.timelineScope!.view as any).draw();
                };

                // Add to keyframe groups
                this.keyframeGroups.push(keyframeGroup);
            });
        });

        // Current time indicator text
        const currentTimeText = new this.timelineScope.PointText({
            point: [10, this.theme.headerHeight - 10],
            content: `Time: ${this.manager.getPosition().toFixed(2)}s`,
            fillColor: 'white',
            fontSize: 12
        });
        currentTimeText.name = 'currentTimeText';

        // Playhead
        this.playhead = new this.timelineScope.Group();

        const playheadX = timelineStartX + (this.manager.getPosition() / this.manager.getDuration()) * (width - timelineStartX);

        // Playhead line
        const playheadLine = new this.timelineScope.Path.Line({
            from: [playheadX, this.theme.headerHeight],
            to: [playheadX, this.theme.headerHeight + tracks.length * this.theme.trackHeight],
            strokeColor: this.theme.playheadColor,
            strokeWidth: 2
        });

        // Playhead handle
        const playheadHandle = new this.timelineScope.Path.RegularPolygon({
            center: [playheadX, this.theme.headerHeight],
            sides: 3,
            radius: 8,
            fillColor: this.theme.playheadColor,
            rotation: 180
        });

        this.playhead.addChild(playheadLine);
        this.playhead.addChild(playheadHandle);

        // Create play/pause button
        this.createPaperPlayButton();

        // Create add keyframe button
        this.createPaperAddKeyframeButton();

        // Draw the view
        (this.timelineScope.view as any).draw();
    }

    /**
     * Create play/pause button in Paper.js
     */
    private createPaperPlayButton(): void {
        if (!this.timelineScope) return;

        const width = this.timelineScope.view.size.width;
        const buttonGroup = new this.timelineScope.Group();
        buttonGroup.name = 'playPauseButton';

        // Button background
        const buttonBackground = new this.timelineScope.Path.Rectangle({
            point: [width - 100, this.theme.headerHeight - 10],
            size: [this.theme.buttonWidth, this.theme.buttonHeight],
            radius: this.theme.buttonRadius,
            fillColor: this.manager.isPlaying() ? this.theme.pauseButtonColor : this.theme.playButtonColor
        });

        // Button text
        const buttonText = new this.timelineScope.PointText({
            point: [width - 80, this.theme.headerHeight - 5],
            content: this.manager.isPlaying() ? 'Pause' : 'Play',
            fillColor: 'white',
            fontSize: 12,
            justification: 'center'
        });

        buttonGroup.addChild(buttonBackground);
        buttonGroup.addChild(buttonText);

        // Make button clickable
        buttonGroup.onClick = () => {
            if (this.manager.isPlaying()) {
                this.manager.pause();
            } else {
                this.manager.play();
            }
        };
    }


    private createButton(config: ButtonConfig): paper.Group | null {
        if (!this.timelineScope) return null;
        const buttonGroup = new this.timelineScope.Group();
        buttonGroup.name = config.text;

        const buttonBackground = new this.timelineScope.Path.Rectangle({
            point: config.position,
            size: [this.theme.buttonWidth, this.theme.buttonHeight],
            radius: this.theme.buttonRadius,
            fillColor: new this.timelineScope.Color(config.color || this.theme.buttonColor)
        });

        const buttonText = new this.timelineScope.PointText({
            point: [config.position[0] + this.theme.buttonWidth / 2, config.position[1] + this.theme.buttonHeight / 2],
            content: config.text,
            fillColor: 'white',
            fontSize: 12,
            justification: 'center'
        });

        buttonGroup.addChild(buttonBackground);
        buttonGroup.addChild(buttonText);

        // Click handler
        buttonGroup.onClick = config.onClick;

        // Hover effects
        buttonGroup.onMouseEnter = () => {
            if (!this.timelineScope) return;
            buttonBackground.fillColor = new this.timelineScope.Color(config.hoverColor || this.theme.buttonHoverColor);
            (this.timelineScope.view as any).draw();

            // cursor
            document.body.style.cursor = 'pointer';
        };

        buttonGroup.onMouseLeave = () => {
            if (!this.timelineScope) return;
            buttonBackground.fillColor = new this.timelineScope.Color(config.color || this.theme.buttonColor);
            (this.timelineScope.view as any).draw();

            // cursor
            document.body.style.cursor = 'default';
        };


        return buttonGroup;
    }

    /**
     * Update play/pause button state
     */
    private updatePaperPlayButton(): void {
        if (!this.timelineScope) return;

        const buttonGroup = (this.timelineScope.project.activeLayer.children as any)['playPauseButton'];
        if (buttonGroup) {
            // Update button background color
            if (buttonGroup.children[0]) {
                (buttonGroup.children[0] as paper.Path).fillColor =
                    this.manager.isPlaying()
                        ? new this.timelineScope.Color(0.8, 0.3, 0.3)
                        : new this.timelineScope.Color(0.3, 0.7, 0.3);
            }

            // Update button text
            if (buttonGroup.children[1]) {
                (buttonGroup.children[1] as paper.PointText).content = this.manager.isPlaying() ? 'Pause' : 'Play';
            }

            (this.timelineScope.view as any).draw();
        }
    }

    /**
     * Create add keyframe button in Paper.js
     */
    private createPaperAddKeyframeButton(): void {
        if (!this.timelineScope) return;

        const width = this.timelineScope.view.size.width;
        const buttonGroup = new this.timelineScope.Group();
        buttonGroup.name = 'addKeyframeButton';

        // Button background
        const buttonBackground = new this.timelineScope.Path.Rectangle({
            point: [width - 50, this.theme.headerHeight - 10],
            size: [this.theme.buttonWidth, this.theme.buttonHeight],
            radius: this.theme.buttonRadius,
            fillColor: new this.timelineScope.Color(0.4, 0.4, 0.6)
        });

        // Button text
        const buttonText = new this.timelineScope.PointText({
            point: [width - 30, this.theme.headerHeight - 5],
            content: 'Key',
            fillColor: 'white',
            fontSize: 12,
            justification: 'center'
        });

        buttonGroup.addChild(buttonBackground);
        buttonGroup.addChild(buttonText);

        // Make button clickable
        buttonGroup.onClick = () => {
            this.manager.addKeyframe();
        };
    }

    /**
     * Create a debug UI for controlling the timeline
     */
    private createDebugUI(): void {
        // Only create UI in non-production environments
        if (process.env.NODE_ENV === 'production') return;

        // Create UI container
        const container = document.createElement('div');
        container.id = 'timeline-debug-ui';
        container.className = 'panel-shape';
        container.style.cssText = `
            position: fixed; 
            width: 50%;
            bottom: 10px; left: 25%; right: 25%; 
            z-index: 1000; 
            padding: 10px; 
            color: white; font-family: Arial, sans-serif; 
            font-size: 12px;`;

        // Title
        const title = document.createElement('div');
        title.textContent = 'Timeline';
        title.style.cssText = `margin-bottom: 5px; font-weight: bold; font-size: 14px;`;
        container.appendChild(title);

        // Initialize Paper.js timeline
        this.initializePaperTimeline(container);

        // Legacy UI elements for compatibility and direct control
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `display: flex; align-items: center; margin-top: 5px;`;

        // Reset button
        // const resetButton = document.createElement('button');
        // resetButton.textContent = 'Reset';
        // resetButton.style.cssText = `margin-right: 5px; padding: 3px 8px;`;
        // resetButton.addEventListener('click', () => {
        //     this.manager.setPosition(0);
        // });
        // controlsContainer.appendChild(resetButton);

        container.appendChild(controlsContainer);

        // Add to document
        document.body.appendChild(container);

        // Store reference
        this.debugUI = container;
    }
} 