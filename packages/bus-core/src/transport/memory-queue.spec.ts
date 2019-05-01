import { MemoryQueue, InMemoryMessage } from './memory-queue'
import { TestCommand, TestEvent, TestCommand2 } from '../test'
import { TransportMessage } from '../transport'
import { Mock } from 'typemoq'
import { Logger } from '@node-ts/logger-core'
import { HandlerRegistry } from '../handler'

const event = new TestEvent()
const command = new TestCommand()
const command2 = new TestCommand2()

describe('MemoryQueue', () => {
  let sut: MemoryQueue
  const handledMessageNames = [TestCommand.NAME, TestEvent.NAME]

  beforeEach(async () => {
    sut = new MemoryQueue(
      Mock.ofType<Logger>().object
    )

    const handlerRegistry = Mock.ofType<HandlerRegistry>()
    handlerRegistry
      .setup(h => h.getMessageNames())
      .returns(() => handledMessageNames)

    await sut.initialize(handlerRegistry.object)
  })

  describe('when publishing an event', () => {
    it('should push the event onto the memory queue', async () => {
      await sut.publish(event)
      expect(sut.depth).toEqual(1)
    })
  })

  describe('when sending a command', () => {
    it('should push the command onto the memory queue', async () => {
      await sut.send(command)
      expect(sut.depth).toEqual(1)
    })
  })

  describe('when sending a message that is not handled', () => {
    it('should not push the message onto the queue', async () => {
      await sut.send(command2)
      expect(sut.depth).toEqual(0)
    })
  })

  describe('when reading the next message', () => {
    it('should return undefined when the queue is empty', async () => {
      const message = await sut.readNextMessage()
      expect(message).toBeUndefined()
    })

    it('should return the message when the queue has one', async () => {
      await sut.publish(event)
      const message = await sut.readNextMessage()
      expect(message!.domainMessage).toEqual(event)
    })

    it('should return the oldest message when there are many', async () => {
      await sut.publish(event)
      await sut.send(command)

      const firstMessage = await sut.readNextMessage()
      expect(firstMessage!.domainMessage).toEqual(event)

      const secondMessage = await sut.readNextMessage()
      expect(secondMessage!.domainMessage).toEqual(command)
    })

    it('should retain the queue depth while the message is unacknowledged', async () => {
      await sut.publish(event)
      expect(sut.depth).toEqual(1)

      const message = await sut.readNextMessage()
      expect(sut.depth).toEqual(1)

      await sut.deleteMessage(message!)
      expect(sut.depth).toEqual(0)
    })
  })

  describe('when returning a message back onto the queue', () => {
    let message: TransportMessage<InMemoryMessage> | undefined
    beforeEach(async () => {
      await sut.publish(event)
      message = await sut.readNextMessage()
    })

    it('should toggle the inFlight flag to true when read', () => {
      expect(message).toBeDefined()
      expect(message!.raw.inFlight).toEqual(true)
    })

    it('should toggle the inFlight flag to false', async () => {
      await sut.returnMessage(message!)
      expect(message!.raw.inFlight).toEqual(false)
    })
  })
})
