"""
Flow management for different session types
Event-driven flow without timers
"""
from typing import Optional, Callable, Dict
from enum import Enum
from .config import SessionConfig


class FlowEvent(str, Enum):
    """Flow events"""
    NEXT = "next_event"
    DONE = "done_event"
    START = "start_event"


class FlowState:
    """Flow state manager"""
    
    def __init__(self, session_config: SessionConfig):
        self.session_config = session_config
        self.current_step = 0
        self.is_active = False
        self.is_complete = False
        self.event_handlers: Dict[FlowEvent, Callable] = {}
    
    def register_handler(self, event: FlowEvent, handler: Callable):
        """Register event handler"""
        self.event_handlers[event] = handler
    
    async def trigger_event(self, event: FlowEvent):
        """Trigger flow event"""
        if event in self.event_handlers:
            await self.event_handlers[event]()
    
    def next_step(self):
        """Move to next step"""
        self.current_step += 1
    
    def complete(self):
        """Mark flow as complete"""
        self.is_complete = True
        self.is_active = False


def create_flow(session_config: SessionConfig) -> FlowState:
    """Create flow based on session type"""
    flow = FlowState(session_config)
    
    if session_config.sessionType == "interview":
        setup_interview_flow(flow)
    elif session_config.sessionType == "presentation":
        setup_presentation_flow(flow)
    elif session_config.sessionType == "simulation":
        setup_simulation_flow(flow)
    
    return flow


def setup_interview_flow(flow: FlowState):
    """Setup interview flow"""
    async def next_event():
        flow.next_step()
        # In real implementation, this would trigger next question
        print(f"Interview: Moving to step {flow.current_step}")
    
    async def done_event():
        flow.complete()
        print("Interview: Session complete")
    
    flow.register_handler(FlowEvent.NEXT, next_event)
    flow.register_handler(FlowEvent.DONE, done_event)


def setup_presentation_flow(flow: FlowState):
    """Setup presentation flow"""
    async def done_event():
        flow.complete()
        print("Presentation: Session complete")
    
    flow.register_handler(FlowEvent.DONE, done_event)


def setup_simulation_flow(flow: FlowState):
    """Setup simulation flow"""
    async def next_event():
        flow.next_step()
        print(f"Simulation: Moving to step {flow.current_step}")
    
    async def done_event():
        flow.complete()
        print("Simulation: Session complete")
    
    flow.register_handler(FlowEvent.NEXT, next_event)
    flow.register_handler(FlowEvent.DONE, done_event)

