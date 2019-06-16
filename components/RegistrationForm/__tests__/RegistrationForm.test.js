import React from 'react';
import { mount } from 'enzyme';
import { wait } from '@testing-library/react';
import { networkErrorMessages, validationErrorMessages } from 'common/constants/messages';
import createSnapshotTest from 'test-utils/createSnapshotTest';
import mockUser from 'test-utils/mockGenerators/mockUser';
import mockPassword from 'test-utils/mockGenerators/mockPassword';
import OperationCodeAPIMock from 'test-utils/mocks/apiMock';
import asyncRenderDiff from 'test-utils/asyncRenderDiff';
import RegistrationForm from '../RegistrationForm';

beforeEach(() => {
  OperationCodeAPIMock.reset();
});

describe('RegistrationForm', () => {
  it('should render with required props', () => {
    createSnapshotTest(<RegistrationForm onSuccess={jest.fn()} />);
  });

  it('should display required error message when blurring past email input', async () => {
    const wrapper = mount(<RegistrationForm onSuccess={jest.fn()} />);

    wrapper.find('input#email').simulate('blur');

    await asyncRenderDiff(wrapper);

    expect(
      wrapper
        .find('Input[type="email"]')
        .find('Alert')
        .text(),
    ).toStrictEqual(validationErrorMessages.required);
  });

  it('should show error when providing non-email to email input', async () => {
    const wrapper = mount(<RegistrationForm onSuccess={jest.fn()} />);

    wrapper
      .find('input#email')
      .simulate('change', { target: { id: 'email', value: 'email' } })
      .simulate('blur');

    await asyncRenderDiff(wrapper);

    expect(
      wrapper
        .find('Input[type="email"]')
        .find('Alert')
        .text(),
    ).toStrictEqual(validationErrorMessages.email);
  });

  it('should show "password required" message when blurring past input', async () => {
    const wrapper = mount(<RegistrationForm onSuccess={jest.fn()} />);

    wrapper.find('input#password').simulate('blur');

    await asyncRenderDiff(wrapper);

    expect(
      wrapper
        .find('Input[type="password"]')
        .find('Alert')
        .text(),
    ).toStrictEqual(validationErrorMessages.required);
  });

  it('should show "invalid password" message when focusing off an invalid password', async () => {
    const wrapper = mount(<RegistrationForm onSuccess={jest.fn()} />);

    const stringWithoutNumber = 'SillyPassword';

    wrapper
      .find('input#password')
      .simulate('change', { target: { id: 'password', value: stringWithoutNumber } })
      .simulate('blur');

    await asyncRenderDiff(wrapper);

    expect(
      wrapper
        .find('Input[type="password"]')
        .find('Alert')
        .text(),
    ).toStrictEqual(validationErrorMessages.password);
  });

  it('should display password match message when both password inputs do not match', async () => {
    const wrapper = mount(<RegistrationForm onSuccess={jest.fn()} />);

    wrapper
      .find('input#password')
      .simulate('change', {
        target: { id: 'password', value: mockPassword() },
      })
      .simulate('blur');

    wrapper
      .find('input#confirm-password')
      .simulate('change', {
        target: { id: 'confirm-password', value: 'something-else' },
      })
      .simulate('blur');

    await asyncRenderDiff(wrapper);

    expect(
      wrapper
        .find('input#confirm-password')
        .closest('Input')
        .find('Alert')
        .text(),
    ).toStrictEqual(validationErrorMessages.passwordMatch);
  });

  it('should submit with valid data in form', async () => {
    const user = mockUser();

    OperationCodeAPIMock.onPost('auth/registration/', {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
      zipcode: user.zipcode,
    }).reply(200, { token: 'fake-token' });

    const successSpy = jest.fn();
    const wrapper = mount(<RegistrationForm onSuccess={successSpy} initialValues={user} />);

    wrapper.find('Button').simulate('submit');
    await asyncRenderDiff(wrapper);

    await wait(() => {
      expect(OperationCodeAPIMock.history.post.length).toStrictEqual(1);
      expect(successSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('should NOT submit with some invalid data in form', async () => {
    const successSpy = jest.fn();

    const invalidFormValues = {
      email: 'not-an-email',
      'confirm-email': 'not-the-same',
      password: 'notvalid',
      'confirm-password': 'notmatching',
      firstName: '',
      lastName: '',
      zipcode: '',
    };

    const wrapper = mount(
      <RegistrationForm onSuccess={successSpy} initialValues={invalidFormValues} />,
    );

    wrapper.find('Button').simulate('submit');
    await asyncRenderDiff(wrapper);

    await wait(() => {
      expect(successSpy).not.toHaveBeenCalled();
      expect(OperationCodeAPIMock.history.post.length).not.toBeGreaterThan(0);
    });

    // All fields + 1 because of always-rendered form error (as opposed to all the field errors)
    expect(wrapper.find('Alert').children()).toHaveLength(
      Object.keys(invalidFormValues).length + 1,
    );
  });

  it('should show "email already registered" message for dupe email registration', async () => {
    const existingUser = mockUser('kylemh.email12@gmail.com');

    OperationCodeAPIMock.onPost('auth/registration/', {
      email: existingUser.email,
      password: existingUser.password,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      zipcode: existingUser.zipcode,
    }).reply(400, {
      email: ['Email has been taken.'],
    });

    const successSpy = jest.fn();
    const wrapper = mount(<RegistrationForm onSuccess={successSpy} initialValues={existingUser} />);

    wrapper.find('Button').simulate('submit');
    await asyncRenderDiff(wrapper);

    expect(successSpy).not.toHaveBeenCalled();
    expect(
      wrapper
        .find('Alert')
        .last()
        .text(),
    ).toStrictEqual('Email has been taken.');
  });

  it('should show a helpful error if the server is down', async () => {
    const user = mockUser();

    OperationCodeAPIMock.onPost('auth/registration/', user).reply(503);

    const successSpy = jest.fn();
    const wrapper = mount(<RegistrationForm onSuccess={successSpy} initialValues={user} />);

    wrapper.find('button[type="submit"]').simulate('submit');
    await asyncRenderDiff(wrapper);

    expect(successSpy).not.toHaveBeenCalled();
    expect(
      wrapper
        .find('Alert')
        .last()
        .text(),
    ).toStrictEqual(networkErrorMessages.serverDown);
  });
});
