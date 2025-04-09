import { TimelineManager } from './TimelineManager';
import { Track, IKeyframe } from './Track';

interface ButtonConfig {
    text: string;
    position: [number, number];
    onClick: () => void;
    color?: string;
    hoverColor?: string;
}

export class TimelineUI {
    private manager: TimelineManager;
    private uiContainer: HTMLElement | null = null;

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
    private timelineScope: paper.PaperScope;
    private playhead: paper.Group | null = null;
    private trackGroups: paper.Group[] = [];
    private timeLabels: paper.PointText[] = [];
    private isDraggingPlayhead = false;
    private isDraggingKeyframe = false;
    private draggedKeyframeData: {
        track: Track<any>,
        keyframe: IKeyframe,
        item: paper.Item,
        originalTime: number
    } | null = null;
    private mouseDownInfo: {
        mouseDownTime: number,
        mouseDownPosition: { x: number, y: number },
    } | null = null;

    constructor(manager: TimelineManager, paper: any) {
        this.manager = manager;

        // Create container
        const { container, canvas } = this.createConatiner();
        this.uiContainer = container;

        // Initialize Paper.js
        this.timelineScope = new paper.PaperScope();

        this.timelineScope.setup(canvas);

        // Set up event handlers
        this.timelineScope.view.onMouseDown = this.onPaperMouseDown.bind(this);
        this.timelineScope.view.onMouseDrag = this.onPaperMouseDrag.bind(this);
        this.timelineScope.view.onMouseUp = this.onPaperMouseUp.bind(this);

        // Subscribe to manager events
        this.manager.observers.subscribe('timelineUpdated', ({ time }) => {
            this.updatePlayheadPosition();
        });

        this.manager.observers.subscribe('playbackStateChanged', ({ isPlaying }) => {
            this.updatePaperPlayButton();
        });

        this.manager.observers.subscribe('keyframeAdded', () => {
            this.repaintPaperTimeline();
        });

        this.manager.observers.subscribe('trackAdded', () => {
            this.repaintPaperTimeline();
        });

        this.manager.observers.subscribe('activeTrackChanged', () => {
            this.repaintPaperTimeline();
        });

        // Draw initial timeline
        this.repaintPaperTimeline();
    }

    /**
     * Toggle debug UI visibility
     */
    public toggleUI(visible?: boolean): void {
        if (!this.uiContainer) return;

        if (visible === undefined) {
            visible = this.uiContainer.style.display === 'none';
        }

        this.uiContainer.style.display = visible ? 'block' : 'none';
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
     * Mouse down handler for Paper.js timeline
     */
    private onPaperMouseDown(event: paper.MouseEvent): void {

        this.mouseDownInfo = {
            mouseDownTime: Date.now(),
            mouseDownPosition: { x: event.point.x, y: event.point.y },
        };

        // Check for keyframe hits FIRST (highest priority)
        const tracks = this.manager.getTracks();
        let hitKeyframe = false;
        tracks.forEach(track => {
            const keyframes = track.getKeyframes();

            keyframes.forEach(keyframe => {
                if (keyframe.paperItem && keyframe.paperItem.hitTest(event.point)) {
                    console.log('keyframe hit', keyframe);
                    this.isDraggingKeyframe = true;
                    this.isDraggingPlayhead = false; // Ensure playhead dragging is off
                    this.draggedKeyframeData = {
                        track,
                        keyframe: keyframe,
                        item: keyframe.paperItem,
                        originalTime: keyframe.time
                    };
                    hitKeyframe = true;
                    return;
                }
            });
            if (hitKeyframe) return;
        });
        if (hitKeyframe) return;

        // Then check if clicking on playhead
        if (this.playhead && this.playhead.hitTest(event.point)) {
            console.log('playhead hit');
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
            console.log('timeline hit');
            this.isDraggingPlayhead = true;
            this.isDraggingKeyframe = false; // Ensure keyframe dragging is off
        }
    }

    /**
     * Mouse drag handler for Paper.js timeline
     */
    private onPaperMouseDrag(event: paper.MouseEvent): void {

        console.log('onPaperMouseDrag', "isDraggingPlayhead", this.isDraggingPlayhead, "isDraggingKeyframe", this.isDraggingKeyframe);

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

        console.log('onPaperMouseUp', "isDraggingPlayhead", this.isDraggingPlayhead, "isDraggingKeyframe", this.isDraggingKeyframe, this.mouseDownInfo);
        if (!this.mouseDownInfo) return;


        const { mouseDownTime, mouseDownPosition } = this.mouseDownInfo;
        const { x, y } = event.point;
        const deltaX = x - mouseDownPosition.x;
        const clickTime = Date.now() - mouseDownTime;

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
            this.repaintPaperTimeline();

            // Update time display
            if ((this.timelineScope.project.activeLayer.children as any)['currentTimeText']) {
                (this.timelineScope.project.activeLayer.children as any)['currentTimeText'].content =
                    `Time: ${this.manager.getPosition().toFixed(2)}s`;
            }

            // Update the timeline position
            this.manager.setPosition(newTime);
        }
    }

    /**
     * Update the Paper.js timeline visualization 
     */
    private repaintPaperTimeline(): void {


        // Clear existing elements
        this.timelineScope.project.activeLayer.removeChildren();
        this.trackGroups = [];

        const width = this.timelineScope.view.size.width;
        const height = this.timelineScope.view.size.height;
        const tracks = this.manager.getTracks();
        const activeTrackIndex = tracks.indexOf(this.manager.getActiveTrack()!);

        // Timeline container
        const timelineBackground = new this.timelineScope.Path.Rectangle({
            point: [this.theme.timelineStart, this.theme.headerHeight],
            size: [width - this.theme.timelineStart, tracks.length * this.theme.trackHeight],
            fillColor: new this.timelineScope.Color(0.25, 0.25, 0.25)
        });

        // Time markings
        for (let i = 0; i <= this.manager.getDuration(); i++) {
            const x = this.theme.timelineStart + (i / this.manager.getDuration()) * (width - this.theme.timelineStart);

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
            const isActive = track.isActive;
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
                this.manager.setActiveTrack(track);
            };

            this.trackGroups.push(trackGroup);

            // Draw keyframes for this track
            const keyframes = track.getKeyframes();
            keyframes.forEach((keyframe, keyframeIndex) => {
                this.createKeyframeDiamond(track, index, keyframe);
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

        const playheadX = this.theme.timelineStart + (this.manager.getPosition() / this.manager.getDuration()) * (width - this.theme.timelineStart);

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

    createKeyframeDiamond(track: Track<any>, trackIndex: number, keyframe: IKeyframe): paper.Item {

        const width = this.timelineScope.view.size.width;
        const y = this.theme.headerHeight + trackIndex * this.theme.trackHeight;

        const keyframeGroup = new this.timelineScope!.Group();
        const keyframeX = this.theme.timelineStart + (keyframe.time / this.manager.getDuration()) * (width - this.theme.timelineStart);

        // Keyframe diamond
        const keyframeDiamond = new this.timelineScope!.Path.RegularPolygon({
            center: [keyframeX, y + 15],
            sides: 4,
            radius: 6,
            fillColor: this.theme.inactiveKeyframeColor,
            strokeColor: 'white',
            strokeWidth: 1,
            rotation: 45
        });

        keyframeGroup.addChild(keyframeDiamond);

        // Add hover effects and cursor 
        keyframeGroup.onMouseEnter = () => {
            document.body.style.cursor = 'pointer';
            keyframeDiamond.scale(1.2); // Slightly enlarge on hover
            keyframeDiamond.fillColor = new this.timelineScope!.Color(this.theme.activeKeyframeHoverColor);
            (this.timelineScope!.view as any).draw();
        };

        keyframeGroup.onMouseLeave = () => {
            document.body.style.cursor = 'default';
            keyframeDiamond.scale(1 / 1.2); // Return to normal size
            keyframeDiamond.fillColor = new this.timelineScope!.Color(this.theme.activeKeyframeColor);
            (this.timelineScope!.view as any).draw();
        };

        keyframe.paperItem = keyframeGroup;

        return keyframeGroup;
    }

    /**
     * Create play/pause button in Paper.js
     */
    private createPaperPlayButton(): void {


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

            buttonBackground.fillColor = new this.timelineScope.Color(config.hoverColor || this.theme.buttonHoverColor);
            (this.timelineScope.view as any).draw();

            // cursor
            document.body.style.cursor = 'pointer';
        };

        buttonGroup.onMouseLeave = () => {

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
    private createConatiner() {

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

        // Legacy UI elements for compatibility and direct control
        const controlsContainer = document.createElement('div');
        controlsContainer.style.cssText = `display: flex; align-items: center; margin-top: 5px;`;

        container.appendChild(controlsContainer);

        // Add to document
        document.body.appendChild(container);



        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.id = 'timeline-canvas';
        canvas.width = 800;
        canvas.height = 100;
        canvas.style.width = '100%';
        canvas.style.height = '100px';
        canvas.style.marginTop = '10px';
        container.appendChild(canvas);

        return { container, canvas };
    }
} 