"""
Event-driven session flow (NEXT / DONE), independent of LiveKit so it is unit-testable.
"""

from __future__ import annotations

import logging
from enum import StrEnum

from .config import SessionConfig

logger = logging.getLogger("coach.flow")


class FlowEvent(StrEnum):
    START = "start_event"
    NEXT = "next_event"
    DONE = "done_event"


class FlowState:
    """Tracks progress through a session. Transitions are idempotent after completion."""

    def __init__(self, session_config: SessionConfig):
        self.session_config = session_config
        self.current_step = 0
        self.is_active = False
        self.is_complete = False

    def start(self) -> bool:
        if self.is_active or self.is_complete:
            return False
        self.is_active = True
        self.current_step = 1
        return True

    def next_step(self) -> bool:
        if self.is_complete:
            return False
        self.is_active = True
        self.current_step += 1
        logger.info("%s: step %d", self.session_config.sessionType, self.current_step)
        return True

    def complete(self) -> bool:
        """Mark as complete. Returns False if it was already complete (dedupe double DONE)."""
        if self.is_complete:
            return False
        self.is_complete = True
        self.is_active = False
        logger.info("%s: complete after %d steps", self.session_config.sessionType, self.current_step)
        return True

    def handle(self, event: FlowEvent) -> bool:
        return {
            FlowEvent.START: self.start,
            FlowEvent.NEXT: self.next_step,
            FlowEvent.DONE: self.complete,
        }[event]()


def create_flow(session_config: SessionConfig) -> FlowState:
    return FlowState(session_config)
